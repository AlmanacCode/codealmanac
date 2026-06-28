import type { AgentRuntimeFailure } from "../../../../shared/agent-runtime/events.js";

export function classifyClaudeFailure(
  raw: string,
  subtype?: string,
): AgentRuntimeFailure {
  if (raw.includes("Not logged in") || raw.includes("authentication")) {
    return {
      provider: "claude",
      code: "claude.not_authenticated",
      message: "Claude is not authenticated in this environment.",
      fix: "Run `claude` and log in, or configure ANTHROPIC_API_KEY for this process.",
      raw,
      details: subtype !== undefined ? { subtype } : undefined,
    };
  }

  if (subtype === "error_max_budget_usd") {
    return {
      provider: "claude",
      code: "claude.max_budget_exceeded",
      message: "Claude stopped because the run exceeded its maximum budget.",
      fix: "Raise the budget for this run or use a cheaper model.",
      raw,
      details: { subtype },
    };
  }

  return {
    provider: "claude",
    code: subtype !== undefined ? `claude.${subtype}` : "claude.process_failed",
    message: raw,
    raw,
    details: subtype !== undefined ? { subtype } : undefined,
  };
}
