import type { AgentProviderId } from "../shared/agent-provider.js";

export interface SpawnedProcess {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: (signal?: string) => void;
}

export type SpawnCliFn = (args: string[]) => SpawnedProcess;

export interface AgentProviderRuntime {
  spawnCli?: SpawnCliFn;
  environment: NodeJS.ProcessEnv;
}

export interface AgentProviderMetadata {
  id: AgentProviderId;
  displayName: string;
  defaultModel: string | null;
  executable: string;
}

export interface ProviderStatus {
  id: AgentProviderId;
  installed: boolean;
  authenticated: boolean;
  readiness: ProviderReadinessStatus;
  detail: string;
  accountLabel?: string;
  installFix?: string;
  loginFix?: string;
}

export type ProviderReadinessStatus =
  | "ready"
  | "missing_executable"
  | "not_authenticated"
  | "unknown";

export interface ProviderModelChoice {
  value: string | null;
  label: string;
  recommended: boolean;
  source: "configured" | "provider-default" | "catalog" | "custom";
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  checkStatus(runtime: AgentProviderRuntime): Promise<ProviderStatus>;
  assertReady(runtime: AgentProviderRuntime): Promise<void>;
  modelChoices?(opts: {
    configuredModel: string | null;
    spawnCli?: SpawnCliFn;
  }): Promise<ProviderModelChoice[]> | ProviderModelChoice[];
}
