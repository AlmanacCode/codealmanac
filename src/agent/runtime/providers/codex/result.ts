import type { AgentRuntimeResult } from "../../../../shared/agent-runtime/events.js";
import type { CodexRunState } from "./types.js";

export function toAgentRuntimeResult(state: CodexRunState): AgentRuntimeResult {
  return {
    success: state.success,
    result: state.result,
    output: state.output,
    providerSessionId: state.providerSessionId,
    turns: state.turns,
    usage: state.usage,
    error: state.error,
    failure: state.failure,
  };
}
