import type { HarnessEvent, HarnessResult } from "./events.js";
import type { ToolRequest } from "./tools.js";

export type HarnessProviderId = "claude" | "codex" | "cursor";
export type OperationKind = "build" | "absorb" | "garden";
export type ProviderSessionPersistence = "ephemeral" | "persistent";

export interface ConnectorRuntimeRequirement {
  provider: "composio";
  toolkit: "github";
  account: string;
  connectedAccountId: string;
  sourceCommand: string;
}

export interface AgentSpec {
  description: string;
  prompt: string;
  tools?: ToolRequest[];
  model?: string;
  effort?: string;
  skills?: string[];
  mcpServers?: Record<string, unknown>;
  maxTurns?: number;
}

export interface AgentRunSpec {
  provider: {
    id: HarnessProviderId;
    model?: string;
    effort?: string;
  };
  cwd: string;
  systemPrompt?: string;
  prompt: string;
  tools?: ToolRequest[];
  agents?: Record<string, AgentSpec>;
  skills?: string[];
  mcpServers?: Record<string, unknown>;
  connectors?: ConnectorRuntimeRequirement[];
  /**
   * Whether the run needs outbound network access (e.g. the agent will use
   * `gh` to reach api.github.com). Sandboxed providers gate the network on
   * this; it is independent of any connector runtime.
   */
  networkAccess?: boolean;
  limits?: {
    maxTurns?: number;
    maxCostUsd?: number;
  };
  providerSession?: {
    persistence?: ProviderSessionPersistence;
  };
  output?: {
    schemaPath?: string;
  };
  metadata?: {
    operation: OperationKind;
    targetKind?: string;
    targetPaths?: string[];
  };
}

export interface HarnessCapabilities {
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
  id: HarnessProviderId;
  displayName: string;
  defaultModel: string | null;
  capabilities: HarnessCapabilities;
}

export interface ProviderStatus {
  id: HarnessProviderId;
  installed: boolean;
  authenticated: boolean;
  detail: string;
}

export interface HarnessRunHooks {
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
}

export interface HarnessProvider {
  metadata: ProviderMetadata;
  checkStatus(): Promise<ProviderStatus>;
  run(spec: AgentRunSpec, hooks?: HarnessRunHooks): Promise<HarnessResult>;
}
