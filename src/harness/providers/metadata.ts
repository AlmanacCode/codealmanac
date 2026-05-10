import type {
  HarnessCapabilities,
  HarnessProviderId,
  ProviderMetadata,
} from "../types.js";

const BASE_CAPABILITIES: Omit<
  HarnessCapabilities,
  | "reasoningEffort"
  | "sessionPersistence"
  | "threadResume"
  | "interrupt"
  | "mcp"
  | "skills"
  | "usage"
  | "cost"
  | "contextUsage"
  | "structuredOutput"
  | "subagents"
  | "policy"
> = {
  nonInteractive: true,
  streaming: true,
  modelOverride: true,
  modelOptions: false,
  fileRead: true,
  fileWrite: true,
  shell: true,
};

export const HARNESS_PROVIDER_METADATA: Record<HarnessProviderId, ProviderMetadata> = {
  claude: {
    id: "claude",
    displayName: "Claude",
    defaultModel: "claude-sonnet-4-6",
    capabilities: {
      ...BASE_CAPABILITIES,
      reasoningEffort: false,
      sessionPersistence: true,
      threadResume: true,
      interrupt: true,
      mcp: true,
      skills: true,
      usage: true,
      cost: true,
      contextUsage: false,
      structuredOutput: true,
      subagents: {
        supported: true,
        programmaticPerRun: true,
        enforcedToolScopes: true,
      },
      policy: {
        sandbox: true,
        strictToolAllowlist: true,
        commandApproval: true,
        toolHook: true,
      },
    },
  },
  codex: {
    id: "codex",
    displayName: "Codex",
    defaultModel: null,
    capabilities: {
      ...BASE_CAPABILITIES,
      modelOptions: true,
      reasoningEffort: false,
      sessionPersistence: true,
      threadResume: true,
      interrupt: true,
      mcp: false,
      skills: false,
      usage: true,
      cost: false,
      contextUsage: false,
      structuredOutput: true,
      subagents: {
        supported: true,
        programmaticPerRun: false,
        enforcedToolScopes: false,
      },
      policy: {
        sandbox: true,
        strictToolAllowlist: false,
        commandApproval: true,
        toolHook: false,
      },
    },
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor",
    defaultModel: null,
    capabilities: {
      ...BASE_CAPABILITIES,
      reasoningEffort: false,
      sessionPersistence: true,
      threadResume: true,
      interrupt: true,
      mcp: true,
      skills: false,
      usage: true,
      cost: false,
      contextUsage: false,
      structuredOutput: false,
      subagents: {
        supported: false,
        programmaticPerRun: false,
        enforcedToolScopes: false,
      },
      policy: {
        sandbox: false,
        strictToolAllowlist: false,
        commandApproval: true,
        toolHook: false,
      },
    },
  },
};
