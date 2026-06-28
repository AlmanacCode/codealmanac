import {
  AGENT_PROVIDER_IDS,
  ALL_AGENT_PROVIDER_IDS,
  DEFAULT_AGENT_PROVIDER_IDS,
  isAgentProviderId,
  type AgentProviderId,
} from "../shared/agent-provider.js";

export {
  AGENT_PROVIDER_IDS,
  ALL_AGENT_PROVIDER_IDS,
  DEFAULT_AGENT_PROVIDER_IDS,
  isAgentProviderId,
  type AgentProviderId,
};

export function isCursorEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.CODEALMANAC_ENABLE_CURSOR === "1";
}

export function getEnabledAgentProviderIds(
  env: NodeJS.ProcessEnv,
): AgentProviderId[] {
  return isCursorEnabled(env)
    ? [...ALL_AGENT_PROVIDER_IDS]
    : [...DEFAULT_AGENT_PROVIDER_IDS];
}

export function isEnabledAgentProviderId(
  value: string,
  env: NodeJS.ProcessEnv,
): value is AgentProviderId {
  return getEnabledAgentProviderIds(env).includes(value as AgentProviderId);
}

export function formatEnabledAgentProviderList(
  env: NodeJS.ProcessEnv,
): string {
  return getEnabledAgentProviderIds(env).join(", ");
}

export function disabledAgentProviderMessage(provider: string): string {
  if (provider === "cursor") {
    return "cursor support is disabled. Set CODEALMANAC_ENABLE_CURSOR=1 to enable experimental Cursor support.";
  }
  return `${provider} support is disabled.`;
}
