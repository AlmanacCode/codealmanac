export const ALL_AGENT_PROVIDER_IDS = ["claude", "codex", "cursor"] as const;
export type AgentProviderId = (typeof ALL_AGENT_PROVIDER_IDS)[number];
export const AGENT_PROVIDER_IDS = ALL_AGENT_PROVIDER_IDS;
export const DEFAULT_AGENT_PROVIDER_IDS = ["claude", "codex"] as const;

export function isCursorEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CODEALMANAC_ENABLE_CURSOR === "1";
}

export function getEnabledAgentProviderIds(
  env: NodeJS.ProcessEnv = process.env,
): AgentProviderId[] {
  return isCursorEnabled(env)
    ? [...ALL_AGENT_PROVIDER_IDS]
    : [...DEFAULT_AGENT_PROVIDER_IDS];
}

export function isEnabledAgentProviderId(
  value: string,
  env: NodeJS.ProcessEnv = process.env,
): value is AgentProviderId {
  return getEnabledAgentProviderIds(env).includes(value as AgentProviderId);
}

export function formatEnabledAgentProviderList(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return getEnabledAgentProviderIds(env).join(", ");
}

export function disabledAgentProviderMessage(provider: string): string {
  if (provider === "cursor") {
    return "cursor support is disabled. Set CODEALMANAC_ENABLE_CURSOR=1 to enable experimental Cursor support.";
  }
  return `${provider} support is disabled.`;
}

export function isAgentProviderId(value: string): value is AgentProviderId {
  return (ALL_AGENT_PROVIDER_IDS as readonly string[]).includes(value);
}
