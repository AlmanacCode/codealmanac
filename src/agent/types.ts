import type { AgentProviderId } from "../config/index.js";

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

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  checkStatus(spawnCli?: SpawnCliFn): Promise<ProviderStatus>;
  assertReady(spawnCli?: SpawnCliFn): Promise<void>;
  modelChoices?(opts: {
    configuredModel: string | null;
    spawnCli?: SpawnCliFn;
  }): Promise<ProviderModelChoice[]> | ProviderModelChoice[];
}
