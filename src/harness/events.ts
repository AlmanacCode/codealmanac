import type { HarnessProviderId } from "./types.js";

export interface AgentUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
  totalProcessedTokens?: number;
  maxTokens?: number | null;
}

export interface HarnessFailure {
  provider: HarnessProviderId;
  message: string;
  fix?: string;
  code?: string;
  raw?: string;
  details?: Record<string, unknown>;
}

export type HarnessToolDisplayKind =
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

export interface HarnessToolDisplay {
  kind?: HarnessToolDisplayKind;
  title?: string;
  path?: string;
  command?: string;
  cwd?: string;
  status?: "started" | "completed" | "failed" | "declined";
  exitCode?: number | null;
  durationMs?: number | null;
  summary?: string;
  raw?: unknown;
}

export interface RunActor {
  threadId: string | null;
  role: "root" | "helper" | "unknown";
  parentThreadId?: string | null;
  label?: string;
  confidence: "provider" | "derived" | "unknown";
}

export interface HarnessEventEnvelopeFields {
  actor?: RunActor;
  raw?: unknown;
  providerEventId?: string;
  providerParentToolUseId?: string;
}

export type HarnessEvent = HarnessEventEnvelopeFields &
  (
  | { type: "text_delta"; content: string }
  | { type: "text"; content: string }
  | {
      type: "tool_use";
      id?: string;
      tool: string;
      input?: string;
      display?: HarnessToolDisplay;
    }
  | {
      type: "tool_result";
      id?: string;
      content?: unknown;
      isError?: boolean;
      display?: HarnessToolDisplay;
    }
  | { type: "tool_summary"; summary: string }
  | { type: "context_usage"; usage: AgentUsage }
  | { type: "error"; error: string; failure?: HarnessFailure }
  | {
      type: "done";
      result?: string;
      providerSessionId?: string;
      costUsd?: number;
      turns?: number;
      usage?: AgentUsage;
      error?: string;
      failure?: HarnessFailure;
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

export type HarnessEventType = HarnessEvent["type"];

export interface HarnessResult {
  success: boolean;
  result: string;
  providerSessionId?: string;
  costUsd?: number;
  turns?: number;
  usage?: AgentUsage;
  error?: string;
  failure?: HarnessFailure;
}
