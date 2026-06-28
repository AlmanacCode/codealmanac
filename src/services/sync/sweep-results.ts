import type { TranscriptCandidate, TranscriptSourceApp } from "../../shared/transcripts.js";
import type { SyncCursorDecision } from "./transcript-cursor.js";

export interface SyncStarted {
  app: TranscriptSourceApp;
  sessionId: string;
  transcriptPath: string;
  repoRoot: string;
  jobId: string;
  fromLine: number;
  toLine: number;
}

export interface SyncReady {
  app: TranscriptSourceApp;
  sessionId: string;
  transcriptPath: string;
  repoRoot: string;
  fromLine: number;
  toLine: number;
}

export interface SyncSkipped {
  app?: TranscriptSourceApp;
  sessionId?: string;
  transcriptPath: string;
  repoRoot?: string;
  reason: string;
}

export interface SyncSummary {
  mode: "sync" | "status";
  scanned: number;
  eligible: number;
  syncSince: string | null;
  ready: SyncReady[];
  started: SyncStarted[];
  skipped: SyncSkipped[];
  needsAttention: SyncSkipped[];
}

export function emptySyncSummary(args: {
  mode: "sync" | "status";
  scanned: number;
  syncSince: Date | null;
}): SyncSummary {
  return {
    mode: args.mode,
    scanned: args.scanned,
    eligible: 0,
    syncSince: args.syncSince?.toISOString() ?? null,
    ready: [],
    started: [],
    skipped: [],
    needsAttention: [],
  };
}

export function syncStartedSummary(
  candidate: TranscriptCandidate,
  jobId: string,
  decision: Extract<SyncCursorDecision, { kind: "ready" }>,
): SyncStarted {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    repoRoot: candidate.repoRoot,
    jobId,
    fromLine: decision.fromLine,
    toLine: decision.toLine,
  };
}

export function syncReadySummary(
  candidate: TranscriptCandidate,
  decision: Extract<SyncCursorDecision, { kind: "ready" }>,
): SyncReady {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    repoRoot: candidate.repoRoot,
    fromLine: decision.fromLine,
    toLine: decision.toLine,
  };
}

export function syncSkippedSummary(
  candidate: Partial<TranscriptCandidate> & { transcriptPath: string },
  reason: string,
): SyncSkipped {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    repoRoot: candidate.repoRoot,
    reason,
  };
}

export function syncCursorContext(args: {
  candidate: TranscriptCandidate;
  fromLine: number;
  lastAbsorbedLine: number;
  lastAbsorbedSize: number;
}): string {
  return [
    "Scheduled sync cursor:",
    `- App: ${args.candidate.app}`,
    `- Session id: ${args.candidate.sessionId}`,
    `- Transcript: ${args.candidate.transcriptPath}`,
    `- Previously absorbed through line: ${args.lastAbsorbedLine}`,
    `- Previously absorbed through byte: ${args.lastAbsorbedSize}`,
    `- Focus on line ${args.fromLine} onward.`,
    "- You may inspect earlier lines only for context.",
    "- Do not re-document decisions already absorbed unless newer lines amend, " +
      "invalidate, or add important nuance to them.",
  ].join("\n");
}
