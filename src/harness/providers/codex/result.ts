import type { HarnessResult } from "../../events.js";
import type { CodexRunState } from "./types.js";

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
