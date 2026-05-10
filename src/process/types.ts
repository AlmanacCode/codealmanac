import type { AgentUsage, HarnessFailure } from "../harness/events.js";
import type { HarnessProviderId, OperationKind } from "../harness/types.js";

export type RunStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type DisplayRunStatus = RunStatus | "stale";

export interface RunSummary {
  created: number;
  updated: number;
  archived: number;
  costUsd?: number;
  turns?: number;
  usage?: AgentUsage;
}

export interface RunRecord {
  version: 1;
  id: string;
  operation: OperationKind;
  status: RunStatus;
  repoRoot: string;
  pid: number;
  provider: HarnessProviderId;
  model?: string;
  providerSessionId?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  logPath: string;
  targetKind?: string;
  targetPaths?: string[];
  summary?: RunSummary;
  error?: string;
  failure?: HarnessFailure;
}

export interface RunView extends RunRecord {
  displayStatus: DisplayRunStatus;
  elapsedMs: number;
}
