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

interface TranscriptSnapshot {
  content: Buffer;
  currentSize: number;
  currentLine: number;
}

type TranscriptReadResult =
  | { ok: true; snapshot: TranscriptSnapshot }
  | { ok: false; reason: string };

type CaptureCursorDecision =
  | { kind: "skip"; reason: string }
  | { kind: "needs_attention"; reason: string; entry: ReturnType<typeof markPrefixMismatch> }
  | { kind: "ready"; fromLine: number; toLine: number };

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
      const eligibilitySkip = candidateEligibility(candidate, args);
      if (eligibilitySkip !== null) {
        summary.skipped.push(eligibilitySkip);
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

      const transcript = await readTranscriptSnapshot(candidate);
      if (!transcript.ok) {
        summary.needsAttention.push(skip(candidate, transcript.reason));
        continue;
      }
      const entry = ledger.sessions[key] ??
        freshLedgerEntry(candidate, transcript.snapshot.content, args.captureSince);

      const decision = evaluateCaptureCursor(entry, transcript.snapshot);
      ledger.sessions[key] = decision.kind === "needs_attention"
        ? decision.entry
        : entry;

      if (decision.kind === "skip") {
        summary.skipped.push(skip(candidate, decision.reason));
        continue;
      }
      if (decision.kind === "needs_attention") {
        summary.needsAttention.push(skip(candidate, decision.reason));
        continue;
      }

      summary.eligible += 1;
      if (args.dryRun) {
        summary.started.push(startedSummary(candidate, "dry-run", decision));
        continue;
      }

      const enqueue = await enqueueCapture({
        candidate,
        entry,
        decision,
        snapshot: transcript.snapshot,
        now: args.now,
        startCapture: args.startCapture,
      });
      if (!enqueue.ok) {
        ledger.sessions[key] = enqueue.entry;
        summary.needsAttention.push(skip(candidate, enqueue.reason));
        await writeLedger(candidate.repoRoot, ledger, args.now);
        continue;
      }
      ledger.sessions[key] = enqueue.entry;
      await writeLedger(candidate.repoRoot, ledger, args.now);
      summary.started.push(startedSummary(candidate, enqueue.runId, decision));
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

function candidateEligibility(
  candidate: SessionCandidate,
  args: {
    captureSince: Date | null;
    quietMs: number;
    now: Date;
  },
): SweepSkipped | null {
  if (args.captureSince !== null && candidate.mtimeMs < args.captureSince.getTime()) {
    return skip(candidate, "before-automation-activation");
  }

  const quietForMs = args.now.getTime() - candidate.mtimeMs;
  if (quietForMs < args.quietMs) {
    return skip(candidate, "quiet-window");
  }
  return null;
}

async function readTranscriptSnapshot(
  candidate: SessionCandidate,
): Promise<TranscriptReadResult> {
  try {
    const content = await readFile(candidate.transcriptPath);
    return {
      ok: true,
      snapshot: {
        content,
        currentSize: content.length,
        currentLine: countLines(content.toString("utf8")),
      },
    };
  } catch (err: unknown) {
    const reason = `read-failed: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, reason };
  }
}

function evaluateCaptureCursor(
  entry: CaptureLedger["sessions"][string],
  snapshot: TranscriptSnapshot,
): CaptureCursorDecision {
  if (entry.status === "pending") {
    return { kind: "skip", reason: "capture-already-pending" };
  }

  if (snapshot.currentSize <= entry.lastCapturedSize) {
    return { kind: "skip", reason: "unchanged" };
  }

  const prefixHash = sha256(snapshot.content.subarray(0, entry.lastCapturedSize));
  if (prefixHash !== entry.lastCapturedPrefixHash) {
    return {
      kind: "needs_attention",
      reason: "prefix-mismatch",
      entry: markPrefixMismatch(entry),
    };
  }

  return {
    kind: "ready",
    fromLine: entry.lastCapturedLine + 1,
    toLine: snapshot.currentLine,
  };
}

function markPrefixMismatch(
  entry: CaptureLedger["sessions"][string],
): CaptureLedger["sessions"][string] {
  return {
    ...entry,
    status: "needs_attention",
    lastError: "transcript prefix no longer matches ledger cursor",
  };
}

async function enqueueCapture(args: {
  candidate: SessionCandidate;
  entry: CaptureLedger["sessions"][string];
  decision: Extract<CaptureCursorDecision, { kind: "ready" }>;
  snapshot: TranscriptSnapshot;
  now: Date;
  startCapture: StartSweepCaptureFn;
}): Promise<
  | { ok: true; runId: string; entry: CaptureLedger["sessions"][string] }
  | { ok: false; reason: string; entry: CaptureLedger["sessions"][string] }
> {
  const result = await args.startCapture({
    candidate: args.candidate,
    contextNote: cursorContext({
      candidate: args.candidate,
      fromLine: args.decision.fromLine,
      lastCapturedLine: args.entry.lastCapturedLine,
      lastCapturedSize: args.entry.lastCapturedSize,
    }),
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: "capture-start-failed",
      entry: {
        ...args.entry,
        status: "failed",
        lastError: result.error,
      },
    };
  }
  const pendingCursor = captureCursor(args.snapshot.content, args.snapshot.currentLine);
  return {
    ok: true,
    runId: result.runId,
    entry: {
      ...args.entry,
      status: "pending",
      pendingToSize: pendingCursor.size,
      pendingToLine: pendingCursor.line,
      pendingPrefixHash: pendingCursor.prefixHash,
      pendingRunId: result.runId,
      pendingStartedAt: args.now.toISOString(),
      lastRunId: result.runId,
      lastError: undefined,
    },
  };
}

function startedSummary(
  candidate: SessionCandidate,
  runId: string,
  decision: Extract<CaptureCursorDecision, { kind: "ready" }>,
): SweepStarted {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    repoRoot: candidate.repoRoot,
    runId,
    fromLine: decision.fromLine,
    toLine: decision.toLine,
  };
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
