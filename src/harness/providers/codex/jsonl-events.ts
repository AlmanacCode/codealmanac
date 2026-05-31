import type { HarnessRunHooks } from "../../types.js";
import { classifyCodexFailure } from "./failures.js";
import {
  objectField,
  stringField,
  stringifyInput,
} from "./fields.js";
import type { CodexRunState } from "./types.js";
import { parseCodexUsage } from "./usage.js";

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

function unwrapCodexJsonlEvent(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const msg = objectField(input, "msg");
  return msg ?? input;
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
