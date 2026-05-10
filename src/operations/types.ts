import type { AgentRunSpec, HarnessProviderId } from "../harness/types.js";
import type {
  StartBackgroundProcessResult,
  StartProcessResult,
} from "../process/index.js";

export interface OperationProviderSelection {
  id: HarnessProviderId;
  model?: string;
  effort?: string;
}

export type OperationMode = "foreground" | "background";

export interface OperationRunResult {
  mode: OperationMode;
  runId: string;
  foreground?: StartProcessResult;
  background?: StartBackgroundProcessResult;
}

export type StartForegroundProcess = (options: {
  repoRoot: string;
  spec: AgentRunSpec;
  runId?: string;
}) => Promise<StartProcessResult>;

export type StartBackgroundProcess = (options: {
  repoRoot: string;
  spec: AgentRunSpec;
  runId?: string;
}) => Promise<StartBackgroundProcessResult>;
