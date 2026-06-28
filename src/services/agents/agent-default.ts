import { parseAgentSelection } from "./provider-selection.js";
import {
  type AgentsAgentProviderId,
  type AgentServiceOptions,
} from "./agent-types.js";
import { writeAgentConfigEntry } from "./agent-config-write.js";

export type AgentUseResult =
  | {
      status: "default-set";
      provider: AgentsAgentProviderId;
      model?: string;
    }
  | {
      status: "unknown-agent";
      input: string;
    };

export async function setDefaultAgent(
  input: { provider: string } & AgentServiceOptions,
): Promise<AgentUseResult> {
  const parsed = parseAgentSelection(input.provider);
  if (parsed.provider === null) {
    return { status: "unknown-agent", input: input.provider };
  }

  await writeAgentConfigEntry(input.cwd, "agent.default", parsed.provider);
  if (parsed.model !== undefined) {
    await writeAgentConfigEntry(
      input.cwd,
      `agent.models.${parsed.provider}`,
      parsed.model,
    );
  }

  return {
    status: "default-set",
    provider: parsed.provider,
    model: parsed.model,
  };
}
