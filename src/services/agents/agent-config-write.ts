import type { AgentProviderId } from "../../shared/agent-provider.js";
import { setConfigEntry } from "../config/index.js";

export async function writeAgentConfigEntry(
  cwd: string,
  key: "agent.default" | `agent.models.${AgentProviderId}`,
  value: string,
): Promise<void> {
  const result = await setConfigEntry({
    cwd,
    key,
    value,
    project: false,
  });
  if (result.status !== "set") {
    throw new Error(`could not write ${key}`);
  }
}
