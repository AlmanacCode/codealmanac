import type { AgentRuntimeResult } from "../../../../shared/agent-runtime/events.js";

export function mapClaudeUsage(value: unknown): AgentRuntimeResult["usage"] {
  if (value === null || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens = numberField(usage, "input_tokens");
  const cachedInputTokens = numberField(usage, "cache_read_input_tokens");
  const outputTokens = numberField(usage, "output_tokens");
  return pruneUndefined({
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens:
      inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined,
  });
}

function numberField(
  record: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = record[field];
  return typeof value === "number" ? value : undefined;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
