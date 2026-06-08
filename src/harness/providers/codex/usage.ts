import type { AgentUsage } from "../../events.js";
import {
  asRecord,
  numberField,
  pruneUndefined,
} from "./fields.js";

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

function parseCodexUsage(value: unknown): AgentUsage | undefined {
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
