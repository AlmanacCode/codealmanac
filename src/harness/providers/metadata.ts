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
      structuredOutput: false,
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
      sessionPersistence: false,
      threadResume: false,
      interrupt: false,
      mcp: false,
      skills: false,
      usage: true,
      cost: false,
      contextUsage: false,
      structuredOutput: true,
      subagents: {
        supported: false,
        programmaticPerRun: false,
        enforcedToolScopes: false,
      },
      policy: {
        sandbox: true,
        strictToolAllowlist: false,
        commandApproval: false,
        toolHook: false,
      },
    },
  },
  cursor: {
    id: "cursor",
    displayName: "Cursor",
    defaultModel: null,
    capabilities: {
      nonInteractive: false,
      streaming: false,
      modelOverride: false,
      modelOptions: false,
      fileRead: false,
      fileWrite: false,
      shell: false,
      reasoningEffort: false,
      sessionPersistence: false,
      threadResume: false,
      interrupt: false,
      mcp: false,
      skills: false,
      usage: false,
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
        commandApproval: false,
        toolHook: false,
      },
    },
  },
};
