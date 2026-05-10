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

export type HarnessEvent =
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
    };

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
