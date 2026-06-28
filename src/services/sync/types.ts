import type {
  LifecycleJobWorkerProgram,
  LifecycleOperationBackgroundStarter,
} from "../lifecycle/index.js";
import type { JobAgentRunner } from "../jobs/runtime/agent-runner.js";
import type { IsPidAlive } from "../../shared/pid-liveness.js";
import type {
  TranscriptCandidate,
  TranscriptReadResult,
  TranscriptSourceApp,
} from "../../shared/transcripts.js";

export interface SyncTranscriptRuntime {
  discoverCandidates(args: {
    apps: TranscriptSourceApp[];
    homeDir: string;
  }): Promise<TranscriptCandidate[]>;
  readSnapshot(transcriptPath: string): Promise<TranscriptReadResult>;
}

export interface SyncWorkflowOptions {
  mode?: "sync" | "status";
  from?: string;
  quiet?: string;
  using?: string;
  now?: Date;
  homeDir: string;
  configPath?: string;
  startBackground?: LifecycleOperationBackgroundStarter;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: JobAgentRunner;
  transcriptRuntime: SyncTranscriptRuntime;
}

export type SyncWorkflowMode = "sync" | "status";
export type SyncWorkflowApp = TranscriptSourceApp;

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
