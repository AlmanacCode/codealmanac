import {
  getEnabledAgentProviderIds,
  type AgentProviderId,
} from "../../../config/index.js";
import type { ProviderStatus, SpawnCliFn } from "../../types.js";
import { getAgentProvider } from "./index.js";

export async function assertAgentAuth(args: {
  provider: AgentProviderId;
  spawnCli?: SpawnCliFn;
}): Promise<void> {
  await getAgentProvider(args.provider).assertReady(args.spawnCli);
}

export async function listProviderStatuses(
  spawnCli?: SpawnCliFn,
): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  for (const id of getEnabledAgentProviderIds()) {
    out.push(await getAgentProvider(id).checkStatus(spawnCli));
  }
  return out;
}
