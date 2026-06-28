import {
  getEnabledAgentProviderIds,
  type AgentProviderId,
} from "../../provider-enablement.js";
import type {
  AgentProviderRuntime,
  ProviderStatus,
  SpawnCliFn,
} from "../../types.js";
import { getAgentProvider } from "./catalog.js";

export async function assertAgentAuth(args: {
  provider: AgentProviderId;
  spawnCli?: SpawnCliFn;
  environment: NodeJS.ProcessEnv;
}): Promise<void> {
  await getAgentProvider(args.provider).assertReady(providerRuntime(args));
}

export async function listProviderStatuses(args: {
  spawnCli?: SpawnCliFn,
  environment: NodeJS.ProcessEnv,
}): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  const runtime = providerRuntime(args);
  for (const id of getEnabledAgentProviderIds(args.environment)) {
    out.push(await getAgentProvider(id).checkStatus(runtime));
  }
  return out;
}

function providerRuntime(args: {
  spawnCli?: SpawnCliFn;
  environment: NodeJS.ProcessEnv;
}): AgentProviderRuntime {
  return {
    spawnCli: args.spawnCli,
    environment: args.environment,
  };
}
