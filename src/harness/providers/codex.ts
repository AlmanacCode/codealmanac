import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";

import type {
  AgentUsage,
  HarnessEvent,
  HarnessFailure,
  HarnessResult,
  HarnessToolDisplay,
} from "../events.js";
import type {
  AgentRunSpec,
  HarnessProvider,
  HarnessRunHooks,
  ProviderStatus,
} from "../types.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";

export interface CodexExecRequest {
  command: "codex";
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export type CodexCliRunFn = (
  request: CodexExecRequest,
  hooks?: HarnessRunHooks,
) => Promise<HarnessResult>;

export type CodexAppServerRunFn = (
  spec: AgentRunSpec,
  hooks?: HarnessRunHooks,
) => Promise<HarnessResult>;

export interface CodexHarnessProviderDeps {
  commandExists?: (command: string) => boolean;
  runStatus?: (command: string, args: string[]) => Promise<{
    ok: boolean;
    detail: string;
  }>;
  runCli?: CodexCliRunFn;
  runAppServer?: CodexAppServerRunFn;
}

export interface CodexRunState {
  success: boolean;
  result: string;
  providerSessionId?: string;
  turns?: number;
  usage?: AgentUsage;
  error?: string;
  failure?: HarnessFailure;
}

export function createCodexHarnessProvider(
  deps: CodexHarnessProviderDeps = {},
): HarnessProvider {
  const metadata = HARNESS_PROVIDER_METADATA.codex;
  const commandExists = deps.commandExists ?? defaultCommandExists;
  const runStatus = deps.runStatus ?? defaultRunStatus;
  const runAppServer = deps.runAppServer ?? runCodexAppServer;

  return {
    metadata,
    checkStatus: async (): Promise<ProviderStatus> => {
      if (!commandExists("codex")) {
        return {
          id: metadata.id,
          installed: false,
          authenticated: false,
          detail: "codex not found on PATH",
        };
      }

      const auth = await runStatus("codex", ["login", "status"]);
      return {
        id: metadata.id,
        installed: true,
        authenticated: auth.ok,
        detail: auth.detail,
      };
    },
    run: async (spec, hooks): Promise<HarnessResult> => {
      if (spec.agents !== undefined && Object.keys(spec.agents).length > 0) {
        return {
          success: false,
          result: "",
          error:
            "Codex exec adapter does not support per-run programmatic agents",
          failure: {
            provider: "codex",
            code: "codex.unsupported_feature",
            message:
              "Codex exec adapter does not support per-run programmatic agents.",
            fix: "Run this operation with a provider that supports per-run subagents.",
          },
        };
      }
      const unsupported = unsupportedCodexSpecFields(spec);
      if (unsupported.length > 0) {
        throw new Error(
          `Codex app-server adapter does not support: ${unsupported.join(", ")}`,
        );
      }
      return runAppServer(spec, hooks);
    },
  };
}

export const codexHarnessProvider = createCodexHarnessProvider();

export function buildCodexExecRequest(spec: AgentRunSpec): CodexExecRequest {
  const unsupported = unsupportedCodexSpecFields(spec);
  if (unsupported.length > 0) {
    throw new Error(
      `Codex exec adapter does not support: ${unsupported.join(", ")}`,
    );
  }
  const args = [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    spec.cwd,
  ];
  if (spec.provider.model !== undefined && spec.provider.model.length > 0) {
    args.push("--model", spec.provider.model);
  }
  if (spec.output?.schemaPath !== undefined) {
    args.push("--output-schema", spec.output.schemaPath);
  }
  args.push(combineCodexPrompt(spec));
  return {
    command: "codex",
    args,
    cwd: spec.cwd,
    env: {
      ...process.env,
      CODEALMANAC_INTERNAL_SESSION: "1",
    },
  };
}

function unsupportedCodexSpecFields(spec: AgentRunSpec): string[] {
  const unsupported: string[] = [];
  if (spec.skills !== undefined && spec.skills.length > 0) unsupported.push("skills");
  if (spec.mcpServers !== undefined && Object.keys(spec.mcpServers).length > 0) {
    unsupported.push("mcpServers");
  }
  if (spec.limits?.maxCostUsd !== undefined) unsupported.push("limits.maxCostUsd");
  return unsupported;
}

export function combineCodexPrompt(spec: AgentRunSpec): string {
  const blocks = [spec.systemPrompt, spec.prompt].filter(
    (block): block is string => block !== undefined && block.trim().length > 0,
  );
  return blocks.join("\n\n---\n\n");
}

export function runCodexCli(
  request: CodexExecRequest,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderr = "";
    const state: CodexRunState = {
      success: false,
      result: "",
    };
    const eventWrites: Promise<void>[] = [];

    const observe = (msg: Record<string, unknown>): void => {
      eventWrites.push(applyCodexJsonlEvent(state, msg, hooks));
    };

    const flushLines = (): void => {
      let idx = stdoutBuf.indexOf("\n");
      while (idx !== -1) {
        const rawLine = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        const line = rawLine.trim();
        if (line.length > 0) {
          try {
            observe(JSON.parse(line) as Record<string, unknown>);
          } catch {
            // Ignore non-JSON chatter; stderr is captured for failures.
          }
        }
        idx = stdoutBuf.indexOf("\n");
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      flushLines();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        success: false,
        result: state.result,
        providerSessionId: state.providerSessionId,
        turns: state.turns,
        usage: state.usage,
        error:
          err.code === "ENOENT"
            ? `${request.command} not found on PATH`
            : err.message,
      });
    });
    child.on("close", async (code) => {
      flushLines();
      if (stdoutBuf.trim().length > 0) {
        try {
          observe(JSON.parse(stdoutBuf.trim()) as Record<string, unknown>);
        } catch {
          // Ignore trailing non-JSON.
        }
      }
      await Promise.allSettled(eventWrites);

      if (code === 0 && state.success) {
        resolve(toHarnessResult(state));
        return;
      }

      const firstStderr = stderr.trim().split("\n")[0];
      const fallbackError =
        firstStderr !== undefined && firstStderr.length > 0
          ? firstStderr
          : `${request.command} exited ${code ?? 1}`;
      const failure = state.failure ?? classifyCodexFailure(fallbackError);
      resolve({
        ...toHarnessResult(state),
        success: false,
        error: state.error ?? failure.message,
        failure,
      });
    });
  });
}

export async function applyCodexJsonlEvent(
  state: CodexRunState,
  input: Record<string, unknown>,
  hooks?: HarnessRunHooks,
): Promise<void> {
  const msg = unwrapCodexJsonlEvent(input);
  const sessionId = stringField(msg, "session_id") ?? stringField(msg, "thread_id");
  if (state.providerSessionId === undefined && sessionId !== undefined) {
    state.providerSessionId = sessionId;
  }

  if (msg.type === "item.completed") {
    const item = objectField(msg, "item");
    if (item?.type === "agent_message") {
      const text = stringField(item, "text");
      if (text !== undefined) {
        state.result = text;
        await hooks?.onEvent?.({ type: "text", content: text });
      }
    }
    if (item?.type === "tool_call") {
      await emitToolUse(item, hooks);
    }
    return;
  }

  if (msg.type === "turn.completed") {
    state.success = true;
    state.turns = 1;
    state.usage = parseCodexUsage(msg.usage);
    await hooks?.onEvent?.({
      type: "done",
      result: state.result,
      providerSessionId: state.providerSessionId,
      turns: state.turns,
      usage: state.usage,
    });
    return;
  }

  if (msg.type === "turn.failed" || msg.type === "error") {
    state.success = false;
    const raw =
      stringField(msg, "message") ??
      stringField(msg, "error") ??
      "codex turn failed";
    const failure = classifyCodexFailure(raw);
    state.error = failure.message;
    state.failure = failure;
    await hooks?.onEvent?.({
      type: "error",
      error: state.error,
      failure,
    });
  }
}

function toHarnessResult(state: CodexRunState): HarnessResult {
  return {
    success: state.success,
    result: state.result,
    providerSessionId: state.providerSessionId,
    turns: state.turns,
    usage: state.usage,
    error: state.error,
    failure: state.failure,
  };
}

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

export interface CodexAppServerRequest {
  command: "codex";
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export function buildCodexAppServerRequest(spec: AgentRunSpec): CodexAppServerRequest {
  const unsupported = unsupportedCodexSpecFields(spec);
  if (unsupported.length > 0) {
    throw new Error(
      `Codex app-server adapter does not support: ${unsupported.join(", ")}`,
    );
  }
  return {
    command: "codex",
    args: ["app-server", "--listen", "stdio://"],
    cwd: spec.cwd,
    env: {
      ...process.env,
      CODEALMANAC_INTERNAL_SESSION: "1",
    },
  };
}

export async function runCodexAppServer(
  spec: AgentRunSpec,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  const request = buildCodexAppServerRequest(spec);
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

    const finish = async (result: HarnessResult): Promise<void> => {
      if (settled) return;
      settled = true;
      for (const entry of pending.values()) {
        entry.reject(new Error("Codex app-server run finished"));
      }
      pending.clear();
      await Promise.allSettled(eventWrites);
      if (!child.killed) child.kill();
      resolve(result);
    };

    const fail = (raw: string): void => {
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

    const write = (message: Record<string, unknown>): void => {
      child.stdin?.write(`${JSON.stringify(message)}\n`);
    };

    const requestRpc = (method: string, params?: unknown): Promise<unknown> => {
      const id = nextRequestId++;
      write({
        id,
        method,
        ...(params !== undefined ? { params } : {}),
      });
      return new Promise((requestResolve, requestReject) => {
        pending.set(String(id), {
          resolve: requestResolve,
          reject: requestReject,
        });
      });
    };

    const respond = (id: string | number, result: unknown): void => {
      write({
        id,
        result,
      });
    };

    const respondUnsupported = (id: string | number, method: string): void => {
      write({
        id,
        error: {
          code: -32601,
          message: `CodeAlmanac does not handle Codex app-server request ${method}`,
        },
      });
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
      const events = mapCodexAppServerNotification(message, state, activeTurnId);
      const turnId = stringField(asRecord(message.params), "turnId");
      activeTurnId = activeTurnId ?? turnId;
      for (const event of events) {
        eventWrites.push(hooks?.onEvent?.(event) ?? Promise.resolve());
      }
      if (message.method === "turn/completed") {
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
            title: "Code Almanac",
            version: "0.2.7",
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
      } catch (err: unknown) {
        fail(err instanceof Error ? err.message : String(err));
      }
    })();
  });
}

function respondToServerRequest(
  id: string | number,
  method: string,
  respond: (id: string | number, result: unknown) => void,
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
    default:
      respondUnsupported(id, method);
  }
}

async function readOutputSchema(schemaPath: string | undefined): Promise<unknown> {
  if (schemaPath === undefined) return null;
  const raw = await readFile(schemaPath, "utf8");
  return JSON.parse(raw) as unknown;
}

export function mapCodexAppServerNotification(
  notification: JsonRpcNotification,
  state: CodexRunState,
  activeTurnId?: string,
): HarnessEvent[] {
  const params = asRecord(notification.params);
  const threadId = stringField(params, "threadId");
  if (state.providerSessionId === undefined && threadId !== undefined) {
    state.providerSessionId = threadId;
  }

  if (notification.method === "item/agentMessage/delta") {
    const delta = stringField(params, "delta");
    return delta !== undefined ? [{ type: "text_delta", content: delta }] : [];
  }

  if (notification.method === "item/plan/delta") {
    const delta = stringField(params, "delta");
    return delta !== undefined ? [{ type: "tool_summary", summary: delta }] : [];
  }

  if (notification.method === "turn/plan/updated") {
    const explanation = stringField(params, "explanation");
    const plan = Array.isArray(params.plan)
      ? params.plan
          .map((step) => stringField(asRecord(step), "step"))
          .filter((step): step is string => step !== undefined)
      : [];
    const summary = [explanation, ...plan].filter(Boolean).join(" | ");
    return summary.length > 0 ? [{ type: "tool_summary", summary }] : [];
  }

  if (notification.method === "thread/tokenUsage/updated") {
    const usage = parseCodexAppServerUsage(params.tokenUsage);
    if (usage !== undefined) state.usage = usage;
    return usage !== undefined ? [{ type: "context_usage", usage }] : [];
  }

  if (notification.method === "item/started") {
    const item = asRecord(params.item);
    const mapped = codexItemToToolEvent(item, "started");
    return mapped !== undefined ? [mapped] : [];
  }

  if (notification.method === "item/completed") {
    const item = asRecord(params.item);
    if (item.type === "agentMessage") {
      const text = stringField(item, "text");
      if (text !== undefined) {
        state.result = text;
        return [{ type: "text", content: text }];
      }
      return [];
    }
    const display = codexItemDisplay(item, "completed");
    if (display === undefined) return [];
    return [
      {
        type: "tool_result",
        id: stringField(item, "id"),
        content: item.aggregatedOutput ?? item.result ?? item.error,
        isError:
          display.status === "failed" ||
          (typeof item.success === "boolean" && item.success === false),
        display,
      },
    ];
  }

  if (
    notification.method === "item/commandExecution/outputDelta" ||
    notification.method === "command/exec/outputDelta" ||
    notification.method === "item/fileChange/outputDelta"
  ) {
    const delta =
      stringField(params, "delta") ?? decodeBase64(stringField(params, "deltaBase64"));
    return delta !== undefined && delta.trim().length > 0
      ? [{ type: "tool_summary", summary: delta.trim() }]
      : [];
  }

  if (notification.method === "turn/completed") {
    const turn = asRecord(params.turn);
    const error = asRecord(turn.error);
    const errorMessage = stringField(error, "message");
    if (errorMessage !== undefined) {
      const failure = classifyCodexFailure(errorMessage);
      state.success = false;
      state.error = failure.message;
      state.failure = failure;
      return [{ type: "error", error: failure.message, failure }];
    }
    state.success = true;
    state.turns = activeTurnId !== undefined ? 1 : 1;
    return [];
  }

  if (notification.method === "error" || notification.method === "warning") {
    const message = stringField(params, "message") ?? notification.method;
    const failure = classifyCodexFailure(message);
    state.success = false;
    state.error = failure.message;
    state.failure = failure;
    return [{ type: "error", error: failure.message, failure }];
  }

  return [];
}

export function parseCodexAppServerUsage(value: unknown): AgentUsage | undefined {
  const usage = asRecord(value);
  const last = asRecord(usage.last);
  const total = asRecord(usage.total);
  const direct = parseCodexUsage(last);
  if (direct === undefined) return undefined;
  return pruneUndefined({
    ...direct,
    totalProcessedTokens:
      numberField(total, "totalTokens") ?? numberField(total, "total_tokens"),
    maxTokens:
      numberField(usage, "modelContextWindow") ??
      numberField(usage, "model_context_window") ??
      null,
  });
}

function codexItemToToolEvent(
  item: Record<string, unknown>,
  status: NonNullable<HarnessToolDisplay["status"]>,
): HarnessEvent | undefined {
  const display = codexItemDisplay(item, status);
  if (display === undefined) return undefined;
  return {
    type: "tool_use",
    id: stringField(item, "id"),
    tool: itemTypeToolName(item),
    input: stringifyInput(item),
    display,
  };
}

function codexItemDisplay(
  item: Record<string, unknown>,
  fallbackStatus: NonNullable<HarnessToolDisplay["status"]>,
): HarnessToolDisplay | undefined {
  const type = stringField(item, "type");
  if (type === "commandExecution") {
    return commandExecutionDisplay(item, fallbackStatus);
  }
  if (type === "fileChange") {
    return {
      kind: "edit",
      title: "Editing file",
      status: itemStatus(item, fallbackStatus),
      durationMs: numberField(item, "durationMs") ?? null,
      raw: item,
    };
  }
  if (type === "mcpToolCall") {
    return {
      kind: "mcp",
      title: `MCP ${stringField(item, "tool") ?? "tool"}`,
      status: itemStatus(item, fallbackStatus),
      raw: item,
    };
  }
  if (type === "dynamicToolCall") {
    const tool = stringField(item, "tool") ?? "Tool";
    return {
      kind: inferToolKind(tool),
      title: toolTitle(tool),
      status: itemStatus(item, fallbackStatus),
      raw: item,
    };
  }
  if (type === "webSearch") {
    return {
      kind: "web",
      title: "Web search",
      summary: stringField(item, "query"),
      status: itemStatus(item, fallbackStatus),
      raw: item,
    };
  }
  if (type === "imageView") {
    return {
      kind: "image",
      title: "Viewing image",
      path: stringField(item, "path"),
      status: itemStatus(item, fallbackStatus),
      raw: item,
    };
  }
  if (type === "collabAgentToolCall") {
    return {
      kind: "agent",
      title: `Agent ${stringField(item, "tool") ?? "tool"}`,
      status: itemStatus(item, fallbackStatus),
      raw: item,
    };
  }
  return undefined;
}

function commandExecutionDisplay(
  item: Record<string, unknown>,
  fallbackStatus: NonNullable<HarnessToolDisplay["status"]>,
): HarnessToolDisplay {
  const command = stringField(item, "command");
  const action = firstCommandAction(item);
  const actionType = stringField(action, "type");
  const title =
    actionType === "read"
      ? "Reading file"
      : actionType === "listFiles"
        ? "Listing files"
        : actionType === "search"
          ? "Searching"
          : "Running command";
  return {
    kind:
      actionType === "read"
        ? "read"
        : actionType === "listFiles" || actionType === "search"
          ? "search"
          : "shell",
    title,
    path: stringField(action, "path"),
    command,
    cwd: stringField(item, "cwd"),
    status: itemStatus(item, fallbackStatus),
    exitCode: numberField(item, "exitCode") ?? null,
    durationMs: numberField(item, "durationMs") ?? null,
    raw: item,
  };
}

function firstCommandAction(item: Record<string, unknown>): Record<string, unknown> {
  const actions = item.commandActions;
  return Array.isArray(actions) ? asRecord(actions[0]) : {};
}

function itemStatus(
  item: Record<string, unknown>,
  fallback: NonNullable<HarnessToolDisplay["status"]>,
): NonNullable<HarnessToolDisplay["status"]> {
  const status = stringField(item, "status");
  if (status === "completed" || status === "failed" || status === "declined") {
    return status;
  }
  return fallback;
}

function itemTypeToolName(item: Record<string, unknown>): string {
  return stringField(item, "type") ?? "tool";
}

function inferToolKind(tool: string): HarnessToolDisplay["kind"] {
  const normalized = tool.toLowerCase();
  if (normalized.includes("read")) return "read";
  if (normalized.includes("write")) return "write";
  if (normalized.includes("edit") || normalized.includes("patch")) return "edit";
  if (normalized.includes("search") || normalized.includes("find")) return "search";
  if (normalized.includes("bash") || normalized.includes("shell")) return "shell";
  if (normalized.includes("agent")) return "agent";
  return "unknown";
}

function toolTitle(tool: string): string {
  switch (inferToolKind(tool)) {
    case "read":
      return "Reading file";
    case "write":
      return "Writing file";
    case "edit":
      return "Editing file";
    case "search":
      return "Searching";
    case "shell":
      return "Running command";
    case "agent":
      return "Agent tool";
    default:
      return tool;
  }
}

function decodeBase64(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}

function unwrapCodexJsonlEvent(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const msg = objectField(input, "msg");
  return msg ?? input;
}

function classifyCodexFailure(raw: string): HarnessFailure {
  const detail = extractJsonDetail(raw);
  const text = detail ?? raw;
  const statusCode = extractStatusCode(raw);
  const model =
    matchFirst(text, /The '([^']+)' model requires a newer version of Codex/) ??
    matchFirst(text, /The '([^']+)' model is not supported/);

  if (text.includes("requires a newer version of Codex") && model !== undefined) {
    return {
      provider: "codex",
      code: "codex.model_requires_newer_cli",
      message: `Codex model ${model} requires a newer Codex CLI.`,
      fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
      raw,
      details: codexFailureDetails({ model, statusCode }),
    };
  }

  if (text.includes("model is not supported") && model !== undefined) {
    return {
      provider: "codex",
      code: "codex.model_unavailable",
      message: `Codex model ${model} is not available for this account.`,
      fix: "Choose a supported model with --using codex/<model>, or update the configured Codex model.",
      raw,
      details: codexFailureDetails({ model, statusCode }),
    };
  }

  if (text.includes("401 Unauthorized") || text.includes("Unauthorized")) {
    return {
      provider: "codex",
      code: "codex.not_authenticated",
      message: "Codex is not authenticated in this environment.",
      fix: "Run `codex login` in the same environment, or make the existing Codex auth available to this process.",
      raw,
      details: codexFailureDetails({ statusCode: statusCode ?? 401 }),
    };
  }

  if (text.includes("not found on PATH")) {
    return {
      provider: "codex",
      code: "codex.not_installed",
      message: "Codex was not found on PATH.",
      fix: "Install Codex or update PATH so the `codex` command is available.",
      raw,
    };
  }

  return {
    provider: "codex",
    code: "codex.process_failed",
    message: text,
    raw,
    details: codexFailureDetails({ statusCode }),
  };
}

function codexFailureDetails(
  details: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const pruned = pruneUndefined(details);
  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

function extractJsonDetail(raw: string): string | undefined {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (parsed !== null && typeof parsed === "object") {
      const detail = (parsed as Record<string, unknown>).detail;
      return typeof detail === "string" && detail.length > 0 ? detail : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function extractStatusCode(raw: string): number | undefined {
  const match = raw.match(/status\s+(\d{3})|(\d{3})\s+(?:Bad Request|Unauthorized)/);
  if (match === null) return undefined;
  const value = match[1] ?? match[2];
  return value !== undefined ? Number.parseInt(value, 10) : undefined;
}

function matchFirst(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1];
}

async function emitToolUse(
  item: Record<string, unknown>,
  hooks: HarnessRunHooks | undefined,
): Promise<void> {
  const tool = stringField(item, "name") ?? stringField(item, "tool_name");
  if (tool === undefined) return;
  await hooks?.onEvent?.({
    type: "tool_use",
    id: stringField(item, "id"),
    tool,
    input: stringifyInput(item.input ?? item.arguments),
  });
}

export function parseCodexUsage(value: unknown): AgentUsage | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const inputTokens =
    numberField(obj, "input_tokens") ?? numberField(obj, "inputTokens");
  const cachedInputTokens =
    numberField(obj, "cached_input_tokens") ??
    numberField(obj, "cachedInputTokens") ??
    numberField(obj, "cacheReadTokens");
  const outputTokens =
    numberField(obj, "output_tokens") ?? numberField(obj, "outputTokens");
  const reasoningOutputTokens =
    numberField(obj, "reasoning_output_tokens") ??
    numberField(obj, "reasoningOutputTokens");
  return pruneUndefined({
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens:
      inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined,
  });
}

function objectField(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = record[field];
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberField(
  record: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = record[field];
  return typeof value === "number" ? value : undefined;
}

function stringifyInput(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}

function defaultCommandExists(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function defaultRunStatus(
  command: string,
  args: string[],
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    let stdout = "";
    let stderr = "";
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err: unknown) {
      resolve({
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({ ok: false, detail: err.message });
    });
    child.on("close", (code) => {
      const text = `${stdout}\n${stderr}`.trim();
      resolve({
        ok: code === 0,
        detail:
          text
            .split("\n")
            .find((line) => line.trim().length > 0)
            ?.trim() ?? (code === 0 ? "ready" : `${command} exited ${code ?? 1}`),
      });
    });
  });
}
