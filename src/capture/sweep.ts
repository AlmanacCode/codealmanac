import { readFile } from "node:fs/promises";

import type { SessionCandidate, SweepApp } from "./discovery/index.js";
import {
  type CaptureLedger,
  countLines,
  captureCursor,
  freshLedgerEntry,
  ledgerKey,
  loadLedgerForRepo,
  reconcileLedger,
  sha256,
  writeLedger,
} from "./ledger.js";
import { acquireRepoSweepLock, releaseRepoSweepLock } from "./lock.js";

export interface SweepStarted {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  repoRoot: string;
  runId: string;
  fromLine: number;
  toLine: number;
}

export interface SweepSkipped {
  app?: SweepApp;
  sessionId?: string;
  transcriptPath: string;
  repoRoot?: string;
  reason: string;
}

export interface SweepSummary {
  scanned: number;
  eligible: number;
  dryRun: boolean;
  captureSince: string | null;
  started: SweepStarted[];
  skipped: SweepSkipped[];
  needsAttention: SweepSkipped[];
}

export interface StartSweepCaptureArgs {
  candidate: SessionCandidate;
  contextNote: string;
}

export type StartSweepCaptureResult =
  | { ok: true; runId: string }
  | { ok: false; error: string };

export type StartSweepCaptureFn = (
  args: StartSweepCaptureArgs,
) => Promise<StartSweepCaptureResult>;

export async function executeCaptureSweep(args: {
  candidates: SessionCandidate[];
  captureSince: Date | null;
  quietMs: number;
  dryRun: boolean;
  now: Date;
  startCapture: StartSweepCaptureFn;
}): Promise<SweepSummary> {
  const summary: SweepSummary = {
    scanned: args.candidates.length,
    eligible: 0,
    dryRun: args.dryRun,
    captureSince: args.captureSince?.toISOString() ?? null,
    started: [],
    skipped: [],
    needsAttention: [],
  };

  const ledgers = new Map<string, CaptureLedger>();
  const heldLocks = new Set<string>();
  try {
    for (const candidate of args.candidates) {
      if (args.captureSince !== null && candidate.mtimeMs < args.captureSince.getTime()) {
        summary.skipped.push(skip(candidate, "before-automation-activation"));
        continue;
      }

      const quietForMs = args.now.getTime() - candidate.mtimeMs;
      if (quietForMs < args.quietMs) {
        summary.skipped.push(skip(candidate, "quiet-window"));
        continue;
      }

      if (!args.dryRun && !heldLocks.has(candidate.repoRoot)) {
        const locked = await acquireRepoSweepLock(candidate.repoRoot, args.now);
        if (!locked) {
          summary.skipped.push(skip(candidate, "sweep-already-running"));
          continue;
        }
        heldLocks.add(candidate.repoRoot);
      }

      const ledger = await loadLedgerForRepo(candidate.repoRoot, ledgers);
      await reconcileLedger(candidate.repoRoot, ledger, args.now);
      const key = ledgerKey(candidate);

      let content: Buffer;
      try {
        content = await readFile(candidate.transcriptPath);
      } catch (err: unknown) {
        const reason = `read-failed: ${err instanceof Error ? err.message : String(err)}`;
        summary.needsAttention.push(skip(candidate, reason));
        continue;
      }
      const currentSize = content.length;
      const currentLine = countLines(content.toString("utf8"));
      const entry = ledger.sessions[key] ??
        freshLedgerEntry(candidate, content, args.captureSince);

      if (entry.status === "pending") {
        summary.skipped.push(skip(candidate, "capture-already-pending"));
        continue;
      }

      if (currentSize <= entry.lastCapturedSize) {
        ledger.sessions[key] = entry;
        summary.skipped.push(skip(candidate, "unchanged"));
        continue;
      }

      const prefixHash = sha256(content.subarray(0, entry.lastCapturedSize));
      if (prefixHash !== entry.lastCapturedPrefixHash) {
        ledger.sessions[key] = {
          ...entry,
          status: "needs_attention",
          lastError: "transcript prefix no longer matches ledger cursor",
        };
        summary.needsAttention.push(skip(candidate, "prefix-mismatch"));
        continue;
      }

      summary.eligible += 1;
      if (args.dryRun) {
        ledger.sessions[key] = entry;
        summary.started.push({
          app: candidate.app,
          sessionId: candidate.sessionId,
          transcriptPath: candidate.transcriptPath,
          repoRoot: candidate.repoRoot,
          runId: "dry-run",
          fromLine: entry.lastCapturedLine + 1,
          toLine: currentLine,
        });
        continue;
      }

      const result = await args.startCapture({
        candidate,
        contextNote: cursorContext({
          candidate,
          fromLine: entry.lastCapturedLine + 1,
          lastCapturedLine: entry.lastCapturedLine,
          lastCapturedSize: entry.lastCapturedSize,
        }),
      });
      if (!result.ok) {
        ledger.sessions[key] = {
          ...entry,
          status: "failed",
          lastError: result.error,
        };
        summary.needsAttention.push(skip(candidate, "capture-start-failed"));
        await writeLedger(candidate.repoRoot, ledger, args.now);
        continue;
      }
      const pendingCursor = captureCursor(content, currentLine);
      ledger.sessions[key] = {
        ...entry,
        status: "pending",
        pendingToSize: pendingCursor.size,
        pendingToLine: pendingCursor.line,
        pendingPrefixHash: pendingCursor.prefixHash,
        pendingRunId: result.runId,
        pendingStartedAt: args.now.toISOString(),
        lastRunId: result.runId,
        lastError: undefined,
      };
      await writeLedger(candidate.repoRoot, ledger, args.now);
      summary.started.push({
        app: candidate.app,
        sessionId: candidate.sessionId,
        transcriptPath: candidate.transcriptPath,
        repoRoot: candidate.repoRoot,
        runId: result.runId,
        fromLine: entry.lastCapturedLine + 1,
        toLine: currentLine,
      });
    }

    if (!args.dryRun) {
      for (const [repoRoot, ledger] of ledgers) {
        await writeLedger(repoRoot, ledger, args.now);
      }
    }
  } finally {
    await Promise.all([...heldLocks].map(releaseRepoSweepLock));
  }

  return summary;
}

function cursorContext(args: {
  candidate: SessionCandidate;
  fromLine: number;
  lastCapturedLine: number;
  lastCapturedSize: number;
}): string {
  return [
    "Scheduled capture cursor:",
    `- App: ${args.candidate.app}`,
    `- Session id: ${args.candidate.sessionId}`,
    `- Transcript: ${args.candidate.transcriptPath}`,
    `- Previously captured through line: ${args.lastCapturedLine}`,
    `- Previously captured through byte: ${args.lastCapturedSize}`,
    `- Focus on line ${args.fromLine} onward.`,
    "- You may inspect earlier lines only for context.",
    "- Do not re-document decisions already captured unless newer lines amend, invalidate, or add important nuance to them.",
  ].join("\n");
}

function skip(candidate: Partial<SessionCandidate> & { transcriptPath: string }, reason: string): SweepSkipped {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    repoRoot: candidate.repoRoot,
    reason,
  };
}
