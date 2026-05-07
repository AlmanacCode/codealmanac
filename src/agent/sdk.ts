import type { AgentProviderId } from "../update/config.js";
import { getAgentProvider, DEFAULT_AGENT_MODEL } from "./providers/index.js";
import type {
  AgentResult,
  AgentStreamMessage,
  AgentUsage,
  RunAgentOptions,
} from "./types.js";

export { DEFAULT_AGENT_MODEL };
export type {
  AgentResult,
  AgentStreamMessage,
  AgentUsage,
  RunAgentOptions,
};

/**
 * Public agent facade used by bootstrap/capture. Provider-specific behavior
 * lives in `src/agent/providers/*`; this function only resolves the selected
 * provider and preserves the historical command-facing API.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const provider: AgentProviderId = opts.provider ?? "claude";
  return await getAgentProvider(provider).run(opts);
}
