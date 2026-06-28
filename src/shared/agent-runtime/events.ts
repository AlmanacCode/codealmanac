import type { AgentProviderId } from "../agent-provider.js";
import type { FinalOutputResult } from "./final-output.js";

export type AgentRuntimeProviderId = AgentProviderId;

export interface AgentUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
  totalProcessedTokens?: number;
  maxTokens?: number | null;
}

export interface AgentRuntimeFailure {
  provider: AgentRuntimeProviderId;
  message: string;
  fix?: string;
  code?: string;
  raw?: string;
  details?: Record<string, unknown>;
}

export type AgentRuntimeToolDisplayKind =
  | "read"
  | "write"
  | "edit"
  | "search"
  | "shell"
  | "mcp"
  | "web"
  | "agent"
  | "image"
  | "unknown";

export interface AgentRuntimeToolDisplay {
  kind?: AgentRuntimeToolDisplayKind;
  title?: string;
  path?: string;
  command?: string;
  cwd?: string;
  status?: "started" | "completed" | "failed" | "declined";
  exitCode?: number | null;
  durationMs?: number | null;
  summary?: string;
  providerThreadId?: string;
  providerTurnId?: string;
}

export interface RunActor {
  threadId: string | null;
  role: "root" | "helper" | "unknown";
  parentThreadId?: string | null;
  label?: string;
  confidence: "provider" | "derived" | "unknown";
}

export interface AgentRuntimeEventEnvelopeFields {
  actor?: RunActor;
  raw?: unknown;
  providerEventId?: string;
  providerParentToolUseId?: string;
}

export type AgentRuntimeEvent = AgentRuntimeEventEnvelopeFields &
  (
  | { type: "text_delta"; content: string }
  | { type: "text"; content: string }
  | {
      type: "tool_use";
      id?: string;
      tool: string;
      input?: string;
      display?: AgentRuntimeToolDisplay;
    }
  | {
      type: "tool_result";
      id?: string;
      content?: unknown;
      isError?: boolean;
      display?: AgentRuntimeToolDisplay;
    }
  | { type: "tool_summary"; summary: string }
  | { type: "context_usage"; usage: AgentUsage }
  | { type: "provider_session"; providerSessionId: string }
  | { type: "error"; error: string; failure?: AgentRuntimeFailure }
  | {
      type: "done";
      result?: string;
      providerSessionId?: string;
      costUsd?: number;
      turns?: number;
      usage?: AgentUsage;
      output?: FinalOutputResult;
      error?: string;
      failure?: AgentRuntimeFailure;
      sourceThreadId?: string;
      sourceTurnId?: string;
      sourceRole?: "root" | "helper" | "unknown";
    }
  | {
      type: "agent_spawned";
      parentThreadId: string;
      childThreadId: string;
      prompt: string;
      model?: string;
      reasoningEffort?: string;
    }
  | {
      type: "agent_wait_started";
      parentThreadId: string;
      childThreadIds: string[];
    }
  | {
      type: "agent_completed";
      threadId: string;
      parentThreadId: string | null;
      result: string;
    }
  );

export type AgentRuntimeEventType = AgentRuntimeEvent["type"];

export interface AgentRuntimeResult {
  success: boolean;
  result: string;
  providerSessionId?: string;
  costUsd?: number;
  turns?: number;
  usage?: AgentUsage;
  output?: FinalOutputResult;
  error?: string;
  failure?: AgentRuntimeFailure;
}

export interface AgentRuntimeRunHooks {
  onEvent?: (event: AgentRuntimeEvent) => void | Promise<void>;
}
