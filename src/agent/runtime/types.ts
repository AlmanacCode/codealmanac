import type {
  AgentRuntimeProviderId,
  AgentRuntimeResult,
  AgentRuntimeRunHooks,
} from "../../shared/agent-runtime/events.js";
import type { OperationSpec } from "../../services/lifecycle/operations/spec.js";

export type {
  AgentRuntimeProviderId,
  AgentRuntimeRunHooks,
} from "../../shared/agent-runtime/events.js";

export interface AgentRuntimeCapabilities {
  nonInteractive: boolean;
  streaming: boolean;
  modelOverride: boolean;
  modelOptions: boolean;
  reasoningEffort: boolean;
  sessionPersistence: boolean;
  threadResume: boolean;
  interrupt: boolean;
  fileRead: boolean;
  fileWrite: boolean;
  shell: boolean;
  mcp: boolean;
  skills: boolean;
  usage: boolean;
  cost: boolean;
  contextUsage: boolean;
  structuredOutput: boolean;
  subagents: {
    supported: boolean;
    programmaticPerRun: boolean;
    enforcedToolScopes: boolean;
  };
  policy: {
    sandbox: boolean;
    strictToolAllowlist: boolean;
    commandApproval: boolean;
    toolHook: boolean;
  };
}

export interface ProviderMetadata {
  id: AgentRuntimeProviderId;
  displayName: string;
  defaultModel: string | null;
  capabilities: AgentRuntimeCapabilities;
}

export interface ProviderStatus {
  id: AgentRuntimeProviderId;
  installed: boolean;
  authenticated: boolean;
  detail: string;
}

export type AgentRuntimeRunner = (
  spec: OperationSpec,
  hooks?: AgentRuntimeRunHooks,
) => Promise<AgentRuntimeResult>;

export interface AgentRuntimeProvider {
  metadata: ProviderMetadata;
  checkStatus(): Promise<ProviderStatus>;
  run: AgentRuntimeRunner;
}
