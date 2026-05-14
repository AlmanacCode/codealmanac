import type {
  AgentUsage,
  HarnessEvent,
  HarnessFailure,
  HarnessResult,
  HarnessToolDisplay,
  RunActor,
} from "../../events.js";
import type { HarnessRunHooks } from "../../types.js";

export interface CodexRunState {
  success: boolean;
  result: string;
  providerSessionId?: string;
  turns?: number;
  usage?: AgentUsage;
  error?: string;
  failure?: HarnessFailure;
  rootThreadId?: string;
  rootTurnId?: string;
  resultSourceThreadId?: string;
  resultSourceTurnId?: string;
  resultSourceRole?: "root" | "helper" | "unknown";
  agentParents?: Record<string, string | null>;
  agentLabels?: Record<string, string>;
  completedAgents?: Record<string, boolean>;
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
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

export function toHarnessResult(state: CodexRunState): HarnessResult {
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

export function mapCodexAppServerNotification(
  notification: JsonRpcNotification,
  state: CodexRunState,
  context: {
    activeTurnId?: string;
    rootThreadId?: string;
    rootTurnId?: string;
    isRootCompletion?: boolean;
  } = {},
): HarnessEvent[] {
  const params = asRecord(notification.params);
  const threadId = stringField(params, "threadId");
  const turnId = stringField(params, "turnId");
  const actor = actorForCodexThread(state, threadId, context.rootThreadId);
  if (state.providerSessionId === undefined && threadId !== undefined) {
    state.providerSessionId = threadId;
  }

  if (notification.method === "item/agentMessage/delta") {
    const delta = stringField(params, "delta");
    return delta !== undefined ? [{ type: "text_delta", content: delta, actor }] : [];
  }

  if (notification.method === "item/plan/delta") {
    const delta = stringField(params, "delta");
    return delta !== undefined ? [{ type: "tool_summary", summary: delta, actor }] : [];
  }

  if (notification.method === "turn/plan/updated") {
    const explanation = stringField(params, "explanation");
    const plan = Array.isArray(params.plan)
      ? params.plan
          .map((step) => stringField(asRecord(step), "step"))
          .filter((step): step is string => step !== undefined)
      : [];
    const summary = [explanation, ...plan].filter(Boolean).join(" | ");
    return summary.length > 0 ? [{ type: "tool_summary", summary, actor }] : [];
  }

  if (notification.method === "thread/tokenUsage/updated") {
    const usage = parseCodexAppServerUsage(params.tokenUsage);
    if (usage !== undefined) state.usage = usage;
    return usage !== undefined ? [{ type: "context_usage", usage, actor }] : [];
  }

  if (notification.method === "item/started") {
    const item = asRecord(params.item);
    const mapped = codexItemToToolEvent(item, "started", actor, { threadId, turnId });
    const lifecycle = codexLifecycleEvents(state, item, actor, "started");
    return [mapped, ...lifecycle].filter((event): event is HarnessEvent => event !== undefined);
  }

  if (notification.method === "item/completed") {
    const item = asRecord(params.item);
    if (item.type === "agentMessage") {
      const text = stringField(item, "text");
      if (text !== undefined) {
        const role = actor.role;
        if (role === "root") {
          state.result = text;
          state.resultSourceThreadId = threadId;
          state.resultSourceTurnId = turnId;
          state.resultSourceRole = role;
        }
        const events: HarnessEvent[] = [{ type: "text", content: text, actor }];
        if (role === "helper" && threadId !== undefined) {
          markAgentCompleted(state, threadId);
          events.push({
            type: "agent_completed",
            threadId,
            parentThreadId: state.agentParents?.[threadId] ?? null,
            result: text,
            actor,
          });
        }
        return events;
      }
      return [];
    }
    const display = codexItemDisplay(item, "completed", actor, { threadId, turnId });
    if (display === undefined) return [];
    const events: HarnessEvent[] = [
      {
        type: "tool_result",
        id: stringField(item, "id"),
        content: item.aggregatedOutput ?? item.result ?? item.error,
        isError:
          display.status === "failed" ||
            (typeof item.success === "boolean" && item.success === false),
        display,
        actor,
      },
    ];
    events.push(...codexLifecycleEvents(state, item, actor, "completed"));
    return events;
  }

  if (
    notification.method === "item/commandExecution/outputDelta" ||
    notification.method === "command/exec/outputDelta" ||
    notification.method === "item/fileChange/outputDelta"
  ) {
    const delta =
      stringField(params, "delta") ?? decodeBase64(stringField(params, "deltaBase64"));
    return delta !== undefined && delta.trim().length > 0
      ? [{ type: "tool_summary", summary: delta.trim(), actor }]
      : [];
  }

  if (notification.method === "turn/completed") {
    const turn = asRecord(params.turn);
    const error = asRecord(turn.error);
    const errorMessage = stringField(error, "message");
    if (errorMessage !== undefined) {
      const failure = classifyCodexFailure(errorMessage);
      if (context.isRootCompletion !== false) {
        state.success = false;
        state.error = failure.message;
        state.failure = failure;
      }
      return [{ type: "error", error: failure.message, failure, actor }];
    }
    if (context.isRootCompletion !== false) {
      state.success = true;
      state.turns = context.activeTurnId !== undefined ? 1 : 1;
    }
    return [];
  }

  if (notification.method === "warning") {
    const message = stringField(params, "message") ?? "Codex warning";
    return [{ type: "tool_summary", summary: `Warning: ${message}`, actor }];
  }

  if (notification.method === "error") {
    const error = asRecord(params.error);
    const message =
      stringField(error, "message") ??
      stringField(error, "detail") ??
      stringField(params, "message") ??
      "Codex error";
    const failure = classifyCodexFailure(message);
    state.success = false;
    state.error = failure.message;
    state.failure = failure;
    return [{ type: "error", error: failure.message, failure, actor }];
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
    totalTokens:
      numberField(last, "totalTokens") ??
      numberField(last, "total_tokens") ??
      direct.totalTokens,
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
  actor: RunActor,
  providerIds?: { threadId?: string; turnId?: string },
): HarnessEvent | undefined {
  const display = codexItemDisplay(item, status, actor, providerIds);
  if (display === undefined) return undefined;
  return {
    type: "tool_use",
    id: stringField(item, "id"),
    tool: itemTypeToolName(item),
    input: stringifyInput(item),
    display,
    actor,
  };
}

function codexItemDisplay(
  item: Record<string, unknown>,
  fallbackStatus: NonNullable<HarnessToolDisplay["status"]>,
  actor: RunActor,
  providerIds?: { threadId?: string; turnId?: string },
): HarnessToolDisplay | undefined {
  const type = stringField(item, "type");
  if (type === "commandExecution") {
    return commandExecutionDisplay(item, fallbackStatus, actor, providerIds);
  }
  if (type === "fileChange") {
    return {
      kind: "edit",
      title: "Editing file",
      status: itemStatus(item, fallbackStatus),
      durationMs: numberField(item, "durationMs") ?? null,
      raw: withActor(item, actor, providerIds),
    };
  }
  if (type === "mcpToolCall") {
    return {
      kind: "mcp",
      title: `MCP ${stringField(item, "tool") ?? "tool"}`,
      status: itemStatus(item, fallbackStatus),
      raw: withActor(item, actor, providerIds),
    };
  }
  if (type === "dynamicToolCall") {
    const tool = stringField(item, "tool") ?? "Tool";
    return {
      kind: inferToolKind(tool),
      title: toolTitle(tool),
      status: itemStatus(item, fallbackStatus),
      raw: withActor(item, actor, providerIds),
    };
  }
  if (type === "webSearch") {
    return {
      kind: "web",
      title: "Web search",
      summary: stringField(item, "query"),
      status: itemStatus(item, fallbackStatus),
      raw: withActor(item, actor, providerIds),
    };
  }
  if (type === "imageView") {
    return {
      kind: "image",
      title: "Viewing image",
      path: stringField(item, "path"),
      status: itemStatus(item, fallbackStatus),
      raw: withActor(item, actor, providerIds),
    };
  }
  if (type === "collabAgentToolCall") {
    return {
      kind: "agent",
      title: `Agent ${stringField(item, "tool") ?? "tool"}`,
      status: itemStatus(item, fallbackStatus),
      raw: withActor(item, actor, providerIds),
    };
  }
  return undefined;
}

function commandExecutionDisplay(
  item: Record<string, unknown>,
  fallbackStatus: NonNullable<HarnessToolDisplay["status"]>,
  actor: RunActor,
  providerIds?: { threadId?: string; turnId?: string },
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
    raw: withActor(item, actor, providerIds),
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

function actorForCodexThread(
  state: CodexRunState,
  threadId: string | undefined,
  rootThreadId: string | undefined,
): RunActor {
  if (threadId === undefined) {
    return {
      threadId: null,
      role: "unknown",
      confidence: "unknown",
      label: "Unknown actor",
    };
  }
  if (rootThreadId === undefined && state.rootThreadId === undefined) {
    state.rootThreadId = threadId;
  }
  const effectiveRootThreadId = rootThreadId ?? state.rootThreadId;
  if (effectiveRootThreadId !== undefined && threadId === effectiveRootThreadId) {
    return {
      threadId,
      role: "root",
      confidence: "provider",
      label: "Main",
    };
  }
  const parentThreadId = state.agentParents?.[threadId] ?? effectiveRootThreadId ?? null;
  return {
    threadId,
    role: "helper",
    parentThreadId,
    confidence: "provider",
    label: state.agentLabels?.[threadId] ?? helperLabel(state, threadId),
  };
}

function codexLifecycleEvents(
  state: CodexRunState,
  item: Record<string, unknown>,
  actor: RunActor,
  phase: "started" | "completed",
): HarnessEvent[] {
  if (stringField(item, "type") !== "collabAgentToolCall") return [];
  const tool = stringField(item, "tool");
  const senderThreadId = stringField(item, "senderThreadId") ?? actor.threadId ?? null;
  const receiverThreadIds = stringArrayField(item, "receiverThreadIds");

  if (tool === "spawnAgent" && phase === "completed") {
    const events: HarnessEvent[] = [];
    for (const childThreadId of receiverThreadIds) {
      registerAgent(state, childThreadId, senderThreadId, stringField(item, "model"));
      events.push({
        type: "agent_spawned",
        parentThreadId: senderThreadId ?? "",
        childThreadId,
        prompt: stringField(item, "prompt") ?? "",
        model: stringField(item, "model"),
        reasoningEffort: stringField(item, "reasoningEffort"),
        actor,
      });
    }
    return events;
  }

  if (tool === "wait" && phase === "started") {
    return [
      {
        type: "agent_wait_started",
        parentThreadId: senderThreadId ?? "",
        childThreadIds: receiverThreadIds,
        actor,
      },
    ];
  }

  if (tool === "wait" && phase === "completed") {
    return completedAgentEventsFromWait(state, item);
  }

  return [];
}

function completedAgentEventsFromWait(
  state: CodexRunState,
  item: Record<string, unknown>,
): HarnessEvent[] {
  const agentsStates = asRecord(item.agentsStates);
  const events: HarnessEvent[] = [];
  for (const [threadId, rawState] of Object.entries(agentsStates)) {
    const agentState = asRecord(rawState);
    if (stringField(agentState, "status") !== "completed") continue;
    if (state.completedAgents?.[threadId] === true) continue;
    const message = stringField(agentState, "message");
    if (message === undefined) continue;
    markAgentCompleted(state, threadId);
    events.push({
      type: "agent_completed",
      threadId,
      parentThreadId: state.agentParents?.[threadId] ?? null,
      result: message,
      actor: actorForCodexThread(state, threadId, state.rootThreadId),
    });
  }
  return events;
}

function registerAgent(
  state: CodexRunState,
  childThreadId: string,
  parentThreadId: string | null,
  _model: string | undefined,
): void {
  state.agentParents = state.agentParents ?? {};
  state.agentLabels = state.agentLabels ?? {};
  state.agentParents[childThreadId] = parentThreadId;
  state.agentLabels[childThreadId] = helperLabel(state, childThreadId);
}

function markAgentCompleted(state: CodexRunState, threadId: string): void {
  state.completedAgents = state.completedAgents ?? {};
  state.completedAgents[threadId] = true;
}

function helperLabel(state: CodexRunState, threadId: string): string {
  state.agentLabels = state.agentLabels ?? {};
  const existing = state.agentLabels[threadId];
  if (existing !== undefined) return existing;
  const count = Object.keys(state.agentLabels).length + 1;
  const label = `Helper ${count}`;
  state.agentLabels[threadId] = label;
  return label;
}

function stringArrayField(
  record: Record<string, unknown>,
  field: string,
): string[] {
  const value = record[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function withActor(
  item: Record<string, unknown>,
  actor: RunActor,
  providerIds?: { threadId?: string; turnId?: string },
): Record<string, unknown> {
  return {
    ...item,
    _codealmanacActor: {
      ...actor,
      providerThreadId: providerIds?.threadId ?? null,
      turnId: providerIds?.turnId ?? null,
    },
  };
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

export function classifyCodexFailure(raw: string): HarnessFailure {
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

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function stringField(
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
