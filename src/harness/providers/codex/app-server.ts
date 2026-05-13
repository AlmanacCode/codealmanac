import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

import type { HarnessResult } from "../../events.js";
import type { AgentRunSpec, HarnessRunHooks } from "../../types.js";
import {
  buildCodexAppServerRequest,
  codexClientVersion,
  combineCodexPrompt,
} from "./request.js";
import {
  asRecord,
  classifyCodexFailure,
  mapCodexAppServerNotification,
  stringField,
  toHarnessResult,
  type CodexRunState,
} from "./events.js";

interface JsonRpcResponse {
  id: number | string;
  result?: unknown;
  error?: {
    message?: string;
    code?: number;
    data?: unknown;
  };
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const CODEX_APP_SERVER_RPC_TIMEOUT_MS = 30_000;
const CODEX_APP_SERVER_RPC_TIMEOUT_ENV =
  "CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS";
const CODEX_APP_SERVER_TURN_TIMEOUT_MS = 30 * 60_000;
const CODEX_APP_SERVER_TURN_TIMEOUT_ENV =
  "CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS";

export async function runCodexAppServer(
  spec: AgentRunSpec,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  const request = buildCodexAppServerRequest(spec);
  const rpcTimeoutMs = codexAppServerRpcTimeoutMs(request.env);
  const turnTimeoutMs = codexAppServerTurnTimeoutMs(request.env);
  return new Promise((resolve) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const pending = new Map<string, PendingRequest>();
    const state: CodexRunState = { success: false, result: "" };
    const eventWrites: Promise<void>[] = [];
    let nextRequestId = 1;
    let stdoutBuf = "";
    let stderr = "";
    let settled = false;
    let activeTurnId: string | undefined;
    let turnTimeout: NodeJS.Timeout | undefined;

    const finish = async (result: HarnessResult): Promise<void> => {
      if (settled) return;
      settled = true;
      if (turnTimeout !== undefined) {
        clearTimeout(turnTimeout);
        turnTimeout = undefined;
      }
      for (const entry of pending.values()) {
        entry.reject(new Error("Codex app-server run finished"));
      }
      pending.clear();
      await Promise.allSettled(eventWrites);
      if (!child.killed) child.kill();
      resolve(result);
    };

    const fail = (raw: string): void => {
      if (settled) return;
      const failure = classifyCodexFailure(raw);
      state.success = false;
      state.error = failure.message;
      state.failure = failure;
      eventWrites.push(
        hooks?.onEvent?.({ type: "error", error: failure.message, failure }) ??
          Promise.resolve(),
      );
      void finish(toHarnessResult(state));
    };

    const startTurnWatchdog = (): void => {
      if (settled) return;
      if (turnTimeout !== undefined) clearTimeout(turnTimeout);
      turnTimeout = setTimeout(() => {
        fail(`Codex app-server turn timed out after ${turnTimeoutMs}ms`);
      }, turnTimeoutMs);
    };

    const write = (message: Record<string, unknown>): void => {
      child.stdin?.write(`${JSON.stringify(message)}\n`);
    };

    const requestRpc = (method: string, params?: unknown): Promise<unknown> => {
      const id = nextRequestId++;
      return new Promise((requestResolve, requestReject) => {
        const timeout = setTimeout(() => {
          pending.delete(String(id));
          requestReject(
            new Error(
              `Codex app-server ${method} timed out after ${rpcTimeoutMs}ms`,
            ),
          );
        }, rpcTimeoutMs);
        pending.set(String(id), {
          resolve: (value) => {
            clearTimeout(timeout);
            requestResolve(value);
          },
          reject: (err) => {
            clearTimeout(timeout);
            requestReject(err);
          },
        });
        write({
          id,
          method,
          ...(params !== undefined ? { params } : {}),
        });
      });
    };

    const respond = (id: string | number, result: unknown): void => {
      write({
        id,
        result,
      });
    };

    const respondError = (id: string | number, code: number, message: string): void => {
      write({
        id,
        error: {
          code,
          message,
        },
      });
    };

    const respondUnsupported = (id: string | number, method: string): void => {
      respondError(
        id,
        -32601,
        `Almanac does not handle Codex app-server request ${method}`,
      );
    };

    const handleResponse = (message: JsonRpcResponse): void => {
      const item = pending.get(String(message.id));
      if (item === undefined) return;
      pending.delete(String(message.id));
      if (message.error !== undefined) {
        item.reject(new Error(message.error.message ?? "Codex app-server request failed"));
        return;
      }
      item.resolve(message.result);
    };

    const handleNotification = (message: JsonRpcNotification): void => {
      const turnId = stringField(asRecord(message.params), "turnId");
      if (
        activeTurnId === undefined &&
        turnId !== undefined &&
        isRootThreadNotification(message, state)
      ) {
        activeTurnId = turnId;
      }
      const isRootCompletion = isRootTurnCompletion(message, state, activeTurnId);
      const events = mapCodexAppServerNotification(message, state, {
        activeTurnId,
        rootThreadId: state.rootThreadId,
        rootTurnId: state.rootTurnId,
        isRootCompletion,
      });
      for (const event of events) {
        eventWrites.push(hooks?.onEvent?.(event) ?? Promise.resolve());
      }
      if (message.method === "turn/completed") {
        if (isRootCompletion === false) {
          return;
        }
        state.success = state.failure === undefined;
        state.turns = 1;
        eventWrites.push(
          hooks?.onEvent?.({
            type: "done",
            result: state.result,
            providerSessionId: state.providerSessionId,
            turns: state.turns,
            usage: state.usage,
            error: state.error,
            failure: state.failure,
            sourceThreadId: state.resultSourceThreadId,
            sourceTurnId: state.resultSourceTurnId,
            sourceRole: state.resultSourceRole,
          }) ?? Promise.resolve(),
        );
        void finish(toHarnessResult(state));
      }
    };

    const handleMessage = (message: unknown): void => {
      if (message === null || typeof message !== "object") return;
      const record = message as Record<string, unknown>;
      if ("id" in record && "method" in record) {
        respondToServerRequest(
          record.id as string | number,
          String(record.method),
          respond,
          respondError,
          respondUnsupported,
        );
        return;
      }
      if ("id" in record) {
        handleResponse(record as unknown as JsonRpcResponse);
        return;
      }
      if ("method" in record) {
        handleNotification(record as unknown as JsonRpcNotification);
      }
    };

    const flushLines = (): void => {
      let idx = stdoutBuf.indexOf("\n");
      while (idx !== -1) {
        const rawLine = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        const line = rawLine.trim();
        if (line.length > 0) {
          try {
            handleMessage(JSON.parse(line) as unknown);
          } catch {
            // Ignore non-JSON chatter; stderr is captured for failures.
          }
        }
        idx = stdoutBuf.indexOf("\n");
      }
    };

    child.stdout?.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      flushLines();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      fail(err.code === "ENOENT" ? `${request.command} not found on PATH` : err.message);
    });
    child.on("close", (code) => {
      if (settled) return;
      flushLines();
      const firstStderr = stderr.trim().split("\n")[0];
      fail(
        firstStderr !== undefined && firstStderr.length > 0
          ? firstStderr
          : `${request.command} app-server exited ${code ?? 1}`,
      );
    });

    void (async () => {
      try {
        await requestRpc("initialize", {
          clientInfo: {
            name: "codealmanac",
            title: "Almanac",
            version: codexClientVersion(),
          },
          capabilities: {
            experimentalApi: true,
          },
        });
        const thread = asRecord(
          await requestRpc("thread/start", {
            cwd: spec.cwd,
            model: spec.provider.model ?? null,
            approvalPolicy: "never",
            sandbox: "workspace-write",
            developerInstructions: spec.systemPrompt ?? null,
            ephemeral: true,
          }),
        );
        const threadObj = asRecord(thread.thread);
        const threadId = stringField(threadObj, "id");
        if (threadId === undefined) {
          throw new Error("Codex app-server thread/start did not return a thread id");
        }
        state.providerSessionId = threadId;
        state.rootThreadId = threadId;
        const outputSchema = await readOutputSchema(spec.output?.schemaPath);
        const turn = asRecord(
          await requestRpc("turn/start", {
            threadId,
            cwd: spec.cwd,
            input: [
              {
                type: "text",
                text: combineCodexPrompt({ ...spec, systemPrompt: undefined }),
                text_elements: [],
              },
            ],
            approvalPolicy: "never",
            sandboxPolicy: {
              type: "workspaceWrite",
              writableRoots: [spec.cwd],
              networkAccess: false,
              excludeTmpdirEnvVar: false,
              excludeSlashTmp: false,
            },
            model: spec.provider.model ?? null,
            effort: spec.provider.effort ?? null,
            outputSchema,
          }),
        );
        activeTurnId = stringField(asRecord(turn.turn), "id");
        state.rootTurnId = activeTurnId;
        startTurnWatchdog();
      } catch (err: unknown) {
        fail(err instanceof Error ? err.message : String(err));
      }
    })();
  });
}

function isRootTurnCompletion(
  message: JsonRpcNotification,
  state: CodexRunState,
  activeTurnId: string | undefined,
): boolean | undefined {
  if (message.method !== "turn/completed") return undefined;
  const params = asRecord(message.params);
  const completedTurnId = stringField(params, "turnId");
  const completedThreadId = stringField(params, "threadId");
  const isRootTurn =
    (state.rootTurnId !== undefined && completedTurnId === state.rootTurnId) ||
    (state.rootTurnId === undefined &&
      activeTurnId !== undefined &&
      completedTurnId === activeTurnId);
  const isRootThread =
    state.rootThreadId !== undefined && completedThreadId === state.rootThreadId;
  return isRootTurn || isRootThread;
}

function isRootThreadNotification(
  message: JsonRpcNotification,
  state: CodexRunState,
): boolean {
  const completedThreadId = stringField(asRecord(message.params), "threadId");
  return (
    state.rootThreadId !== undefined &&
    completedThreadId === state.rootThreadId
  );
}

function respondToServerRequest(
  id: string | number,
  method: string,
  respond: (id: string | number, result: unknown) => void,
  respondError: (id: string | number, code: number, message: string) => void,
  respondUnsupported: (id: string | number, method: string) => void,
): void {
  switch (method) {
    case "item/commandExecution/requestApproval":
      respond(id, { decision: "decline" });
      return;
    case "item/fileChange/requestApproval":
      respond(id, { decision: "decline" });
      return;
    case "execCommandApproval":
    case "applyPatchApproval":
      respond(id, { decision: "denied" });
      return;
    case "item/tool/requestUserInput":
      respond(id, { answers: {} });
      return;
    case "mcpServer/elicitation/request":
      respond(id, { action: "decline", content: null, _meta: null });
      return;
    case "item/tool/call":
      respond(id, { contentItems: [], success: false });
      return;
    case "item/permissions/requestApproval":
      respond(id, {
        permissions: {},
        scope: "turn",
        strictAutoReview: true,
      });
      return;
    case "account/chatgptAuthTokens/refresh":
      respondError(
        id,
        -32001,
        "Almanac does not manage ChatGPT auth tokens for Codex app-server.",
      );
      return;
    default:
      respondUnsupported(id, method);
  }
}

async function readOutputSchema(schemaPath: string | undefined): Promise<unknown> {
  if (schemaPath === undefined) return null;
  const raw = await readFile(schemaPath, "utf8");
  return JSON.parse(raw) as unknown;
}

function codexAppServerRpcTimeoutMs(env: NodeJS.ProcessEnv): number {
  return parsePositiveEnvInt(
    env[CODEX_APP_SERVER_RPC_TIMEOUT_ENV],
    CODEX_APP_SERVER_RPC_TIMEOUT_MS,
  );
}

function codexAppServerTurnTimeoutMs(env: NodeJS.ProcessEnv): number {
  return parsePositiveEnvInt(
    env[CODEX_APP_SERVER_TURN_TIMEOUT_ENV],
    CODEX_APP_SERVER_TURN_TIMEOUT_MS,
  );
}

function parsePositiveEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
