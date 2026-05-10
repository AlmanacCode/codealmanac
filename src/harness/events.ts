export interface AgentUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
  totalProcessedTokens?: number;
  maxTokens?: number | null;
}

export type HarnessEvent =
  | { type: "text_delta"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_use"; id?: string; tool: string; input?: string }
  | {
      type: "tool_result";
      id?: string;
      content?: unknown;
      isError?: boolean;
    }
  | { type: "tool_summary"; summary: string }
  | { type: "context_usage"; usage: AgentUsage }
  | { type: "error"; error: string }
  | {
      type: "done";
      result?: string;
      providerSessionId?: string;
      costUsd?: number;
      turns?: number;
      usage?: AgentUsage;
      error?: string;
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
}
