import type {
  AgentUsage,
  AgentRuntimeFailure,
} from "../../../../shared/agent-runtime/events.js";
import type {
  FinalOutputResult,
  FinalOutputSpec,
} from "../../../../shared/agent-runtime/final-output.js";

export interface CodexRunState {
  success: boolean;
  result: string;
  outputSpec?: FinalOutputSpec;
  output?: FinalOutputResult;
  providerSessionId?: string;
  turns?: number;
  usage?: AgentUsage;
  error?: string;
  failure?: AgentRuntimeFailure;
  rootThreadId?: string;
  rootTurnId?: string;
  resultSourceThreadId?: string;
  resultSourceTurnId?: string;
  resultSourceRole?: "root" | "helper" | "unknown";
  agentParents?: Record<string, string | null>;
  agentLabels?: Record<string, string>;
  completedAgents?: Record<string, boolean>;
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
}
