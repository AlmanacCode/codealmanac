import type {
  HarnessCapabilities,
  HarnessProviderId,
  ProviderMetadata,
} from "../types.js";
import { PROVIDER_DEFINITIONS } from "../../agent/provider-id.js";

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
    displayName: PROVIDER_DEFINITIONS.claude.displayName,
    defaultModel: PROVIDER_DEFINITIONS.claude.defaultModel,
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
    displayName: PROVIDER_DEFINITIONS.codex.displayName,
    defaultModel: PROVIDER_DEFINITIONS.codex.defaultModel,
    capabilities: {
      ...BASE_CAPABILITIES,
      modelOptions: true,
      reasoningEffort: true,
      sessionPersistence: false,
      threadResume: false,
      interrupt: false,
      mcp: false,
      skills: false,
      usage: true,
      cost: false,
      contextUsage: true,
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
    displayName: PROVIDER_DEFINITIONS.cursor.displayName,
    defaultModel: PROVIDER_DEFINITIONS.cursor.defaultModel,
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
