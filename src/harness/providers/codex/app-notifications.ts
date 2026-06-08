import type { HarnessEvent } from "../../events.js";
import { parseJsonSchemaFinalOutputText } from "../../final-output.js";
import {
  actorForCodexThread,
  codexLifecycleEvents,
  markAgentCompleted,
} from "./actors.js";
import { classifyCodexFailure } from "./failures.js";
import {
  asRecord,
  numberField,
  stringField,
} from "./fields.js";
import {
  codexItemDisplay,
  codexItemToToolEvent,
} from "./tool-display.js";
import type {
  CodexRunState,
  JsonRpcNotification,
} from "./types.js";
import { parseCodexAppServerUsage } from "./usage.js";

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
          if (state.outputSpec?.kind === "json_schema") {
            try {
              state.output = parseJsonSchemaFinalOutputText(state.outputSpec, text);
            } catch (err: unknown) {
              const message =
                err instanceof Error ? err.message : String(err);
              state.error = message;
              state.failure = {
                provider: "codex",
                code: "codex.structured_output_invalid",
                message,
                raw: text,
                details: { output: state.outputSpec.name },
              };
            }
          }
        }
        const events: HarnessEvent[] = [{ type: "text", content: text, actor }];
        if (role === "root" && state.failure?.code === "codex.structured_output_invalid") {
          events.push({
            type: "error",
            error: state.failure.message,
            failure: state.failure,
            actor,
          });
        }
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
    const display = codexItemDisplay(item, "completed", { threadId, turnId });
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
      const failure = classifyCodexFailure({
        message: errorMessage,
        statusCode: numberField(error, "statusCode") ?? numberField(error, "code"),
        data: error,
      });
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
    const failure = classifyCodexFailure({
      message,
      statusCode: numberField(error, "statusCode") ?? numberField(error, "code"),
      data: error,
    });
    state.success = false;
    state.error = failure.message;
    state.failure = failure;
    return [{ type: "error", error: failure.message, failure, actor }];
  }

  return [];
}

function decodeBase64(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}
