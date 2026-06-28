import type { AgentProviderId } from "../../../shared/agent-provider.js";
import type { FinalOutputSpec } from "../../../shared/agent-runtime/final-output.js";
import type { ToolRequest } from "../../../shared/agent-runtime/tools.js";

export type OperationKind = "build" | "absorb" | "garden";
export type ProviderSessionPersistence = "ephemeral" | "persistent";

export interface OperationAgentSpec {
  description: string;
  prompt: string;
  tools?: ToolRequest[];
  model?: string;
  effort?: string;
  skills?: string[];
  mcpServers?: Record<string, unknown>;
  maxTurns?: number;
}

export interface OperationSpec {
  provider: {
    id: AgentProviderId;
    model?: string;
    effort?: string;
  };
  cwd: string;
  systemPrompt?: string;
  prompt: string;
  tools?: ToolRequest[];
  agents?: Record<string, OperationAgentSpec>;
  skills?: string[];
  mcpServers?: Record<string, unknown>;
  networkAccess?: boolean;
  limits?: {
    maxTurns?: number;
    maxCostUsd?: number;
  };
  providerSession?: {
    persistence?: ProviderSessionPersistence;
  };
  output?: FinalOutputSpec;
  metadata?: {
    operation: OperationKind;
    targetKind?: string;
    targetPaths?: string[];
  };
}
