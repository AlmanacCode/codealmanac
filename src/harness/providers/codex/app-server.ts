import type { HarnessResult } from "../../events.js";
import type { HarnessRunHooks } from "../../types.js";
import type { OperationSpec } from "../../../operations/spec.js";
import { spawnManagedChildProcess } from "../../process/managed-child.js";
import { buildCodexAppServerRequest } from "./request.js";
import { mapCodexAppServerNotification } from "./app-notifications.js";
import {
  codexAppServerRpcTimeoutMs,
  codexAppServerSandboxMode,
  codexAppServerTurnTimeoutMs,
  type CodexAppServerSandboxMode,
} from "./app-server-config.js";
import { startCodexAppServerTurn } from "./app-server-session.js";
import { classifyCodexFailure } from "./failures.js";
import {
  asRecord,
  stringField,
} from "./fields.js";
import { toHarnessResult } from "./result.js";
import { respondToCodexServerRequest } from "./server-requests.js";
import type { CodexRunState } from "./types.js";

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

export async function runCodexAppServer(
  spec: OperationSpec,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  const request = buildCodexAppServerRequest(spec);
  const rpcTimeoutMs = codexAppServerRpcTimeoutMs(request.env);
  const turnTimeoutMs = codexAppServerTurnTimeoutMs(request.env);
  let sandboxMode: CodexAppServerSandboxMode;
  try {
    sandboxMode = codexAppServerSandboxMode(request.env);
  } catch (err: unknown) {
    return {
      success: false,
      result: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return new Promise((resolve) => {
    const managed = spawnManagedChildProcess(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const child = managed.child;
    const pending = new Map<string, PendingRequest>();
    const state: CodexRunState = {
      success: false,
      result: "",
      outputSpec: spec.output,
    };
    const eventWrites: Promise<void>[] = [];
    let nextRequestId = 1;
    let stdoutBuf = "";
    let stderr = "";
    let settled = false;
    let activeTurnId: string | undefined;
    let turnTimeout: NodeJS.Timeout | undefined;
    const removeSignalHandlers = installSignalHandlers((signal) => {
      fail(`Codex app-server interrupted by ${signal}`);
    });

    const finish = async (result: HarnessResult): Promise<void> => {
      if (settled) return;
      settled = true;
      removeSignalHandlers();
      if (turnTimeout !== undefined) {
        clearTimeout(turnTimeout);
        turnTimeout = undefined;
      }
      for (const entry of pending.values()) {
        entry.reject(new Error("Codex app-server run finished"));
      }
      pending.clear();
      await Promise.allSettled(eventWrites);
      const cleanupError = await terminateManagedChildSafely(managed);
      if (cleanupError !== undefined) {
        await hooks?.onEvent?.({
          type: "error",
          error: cleanupError,
        });
      }
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
            output: state.output,
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
        respondToCodexServerRequest(
          record.id as string | number,
          String(record.method),
          { respond, respondError, respondUnsupported },
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
        const started = await startCodexAppServerTurn({
          spec,
          sandboxMode,
          requestRpc,
          state,
          emitEvent: (event) => {
            eventWrites.push(hooks?.onEvent?.(event) ?? Promise.resolve());
          },
        });
        activeTurnId = started.activeTurnId;
        startTurnWatchdog();
      } catch (err: unknown) {
        fail(err instanceof Error ? err.message : String(err));
      }
    })();
  });
}

function installSignalHandlers(onSignal: (signal: NodeJS.Signals) => void): () => void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  const handlers = signals.map((signal) => {
    const handler = () => onSignal(signal);
    process.once(signal, handler);
    return { signal, handler };
  });
  return () => {
    for (const { signal, handler } of handlers) {
      process.off(signal, handler);
    }
  };
}

async function terminateManagedChildSafely(
  managed: ReturnType<typeof spawnManagedChildProcess>,
): Promise<string | undefined> {
  try {
    await managed.terminate({ graceMs: 500 });
    return undefined;
  } catch (err: unknown) {
    return `Provider process cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
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
