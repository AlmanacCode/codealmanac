import type {
  AgentDefinition,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

import type { AgentProviderId } from "../update/config.js";

export interface SpawnedProcess {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: (signal?: string) => void;
}

export type SpawnCliFn = (args: string[]) => SpawnedProcess;

export interface AgentProviderCapabilities {
  transport: "sdk" | "cli-jsonl";
  writesFiles: boolean;
  supportsModelOverride: boolean;
  supportsStreaming: boolean;
  supportsSessionId: boolean;
  supportsUsage: boolean;
  supportsCost: boolean;
  supportsProviderReportedTurns: boolean;
  supportsProgrammaticSubagents: boolean;
  supportsStrictToolAllowlist: boolean;
}

export interface AgentProviderMetadata {
  id: AgentProviderId;
  displayName: string;
  defaultModel: string | null;
  executable: string;
  capabilities: AgentProviderCapabilities;
}

export interface ProviderStatus {
  id: AgentProviderId;
  installed: boolean;
  authenticated: boolean;
  detail: string;
}

export interface ProviderModelChoice {
  value: string | null;
  label: string;
  recommended: boolean;
  source: "configured" | "provider-default" | "catalog" | "custom";
}

export interface RunAgentOptions {
  /** Full system prompt text, usually loaded from `prompts/*.md`. */
  systemPrompt: string;
  /** User prompt / kick-off message. */
  prompt: string;
  /** Tool auto-approval list for providers that support it. */
  allowedTools: string[];
  /** Claude SDK subagent definitions. Other providers use prompt fallback. */
  agents?: Record<string, AgentDefinition>;
  /** Working directory the agent's tools operate in. */
  cwd: string;
  /** Agent provider. Defaults to Claude for backward compatibility. */
  provider?: AgentProviderId;
  /** Provider model override. */
  model?: string;
  /** Hard cap on turns for providers that support it. */
  maxTurns?: number;
  /** Observer called for every raw provider message/event. */
  onMessage?: (msg: AgentStreamMessage) => void;
}

export type AgentStreamMessage = SDKMessage | Record<string, unknown>;

export interface AgentUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
}

export interface AgentResult {
  success: boolean;
  cost: number;
  turns: number;
  result: string;
  sessionId?: string;
  usage?: AgentUsage;
  error?: string;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  checkStatus(spawnCli?: SpawnCliFn): Promise<ProviderStatus>;
  assertReady(spawnCli?: SpawnCliFn): Promise<void>;
  run(opts: RunAgentOptions): Promise<AgentResult>;
  modelChoices?(args: {
    configuredModel: string | null;
    spawnCli?: SpawnCliFn;
  }): Promise<ProviderModelChoice[]> | ProviderModelChoice[];
}
