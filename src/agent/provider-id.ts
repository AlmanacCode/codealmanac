export const ALL_AGENT_PROVIDER_IDS = ["claude", "codex", "cursor"] as const;
export type AgentProviderId = (typeof ALL_AGENT_PROVIDER_IDS)[number];
export type ProviderId = AgentProviderId;

export const AGENT_PROVIDER_IDS = ALL_AGENT_PROVIDER_IDS;
export const DEFAULT_AGENT_PROVIDER_IDS = ["claude", "codex"] as const;

export const PROVIDER_DEFINITIONS: Record<AgentProviderId, {
  displayName: string;
  defaultModel: string | null;
  executable: string;
}> = {
  claude: {
    displayName: "Claude",
    defaultModel: "claude-sonnet-4-6",
    executable: "claude",
  },
  codex: {
    displayName: "Codex",
    defaultModel: null,
    executable: "codex",
  },
  cursor: {
    displayName: "Cursor",
    defaultModel: null,
    executable: "cursor-agent",
  },
};

export function isAgentProviderId(value: string): value is AgentProviderId {
  return (ALL_AGENT_PROVIDER_IDS as readonly string[]).includes(value);
}
