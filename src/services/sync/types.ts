import type { StartBackgroundJob } from "../../operations/index.js";

export interface SyncWorkflowOptions {
  mode?: "sync" | "status";
  from?: string;
  quiet?: string;
  using?: string;
  now?: Date;
  homeDir?: string;
  configPath?: string;
  startBackground?: StartBackgroundJob;
}

export type SyncWorkflowMode = "sync" | "status";
export type SyncWorkflowApp = "claude" | "codex";

export interface SyncWorkflowReadyItem {
  app: SyncWorkflowApp;
  sessionId: string;
  transcriptPath: string;
  repoRoot: string;
  fromLine: number;
  toLine: number;
}

export interface SyncWorkflowStartedItem {
  app: SyncWorkflowApp;
  sessionId: string;
  transcriptPath: string;
  repoRoot: string;
  fromLine: number;
  toLine: number;
  jobId: string;
}

export interface SyncWorkflowSkippedItem {
  app?: SyncWorkflowApp;
  sessionId?: string;
  transcriptPath: string;
  repoRoot?: string;
  reason: string;
}

export interface SyncWorkflowSummary {
  mode: SyncWorkflowMode;
  scanned: number;
  eligible: number;
  syncSince: string | null;
  ready: SyncWorkflowReadyItem[];
  started: SyncWorkflowStartedItem[];
  skipped: SyncWorkflowSkippedItem[];
  needsAttention: SyncWorkflowSkippedItem[];
}

export type SyncWorkflowResult =
  | { status: "completed"; summary: SyncWorkflowSummary }
  | { status: "invalid"; error: Error };
