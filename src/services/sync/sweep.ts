import {
  type TranscriptCandidate,
  type TranscriptReadResult,
  type TranscriptSnapshot,
} from "../../shared/transcripts.js";
import {
  type LedgerEntry,
  type SyncLedger,
  freshLedgerEntry,
  ledgerKey,
  reconcileLedger,
} from "./ledger.js";
import {
  type SyncCursorDecision,
  evaluateSyncCursor,
  failedLedgerEntry,
  pendingLedgerEntry,
} from "./transcript-cursor.js";
import {
  type SyncSkipped,
  type SyncSummary,
  emptySyncSummary,
  syncCursorContext,
  syncReadySummary,
  syncSkippedSummary,
  syncStartedSummary,
} from "./sweep-results.js";
import type { IsPidAlive } from "../../shared/pid-liveness.js";
import {
  loadLedgerForRepo,
  writeLedger,
} from "../../stores/sync/ledger.js";
import { acquireRepoSyncLock, releaseRepoSyncLock } from "../../stores/sync/lock.js";
import { listJobRecords } from "../../stores/jobs/index.js";

export interface StartSyncAbsorbArgs {
  candidate: TranscriptCandidate;
  contextNote: string;
}

export type StartSyncAbsorbResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

export type StartSyncAbsorbFn = (
  args: StartSyncAbsorbArgs,
) => Promise<StartSyncAbsorbResult>;
export type ReadSyncTranscriptSnapshotFn = (
  transcriptPath: string,
) => Promise<TranscriptReadResult>;

export async function executeSyncSweep(args: {
  candidates: TranscriptCandidate[];
  syncSince: Date | null;
  quietMs: number;
  mode: "sync" | "status";
  now: Date;
  lockOwnerPid: number;
  isPidAlive: IsPidAlive;
  readTranscriptSnapshot: ReadSyncTranscriptSnapshotFn;
  startAbsorb: StartSyncAbsorbFn;
}): Promise<SyncSummary> {
  const summary = emptySyncSummary({
    mode: args.mode,
    scanned: args.candidates.length,
    syncSince: args.syncSince,
  });

  const ledgers = new Map<string, SyncLedger>();
  const internalSessionIds = new Map<string, Set<string>>();
  const heldLocks = new Set<string>();
  try {
    for (const candidate of args.candidates) {
      const eligibilitySkip = candidateEligibility(candidate, args);
      if (eligibilitySkip !== null) {
        summary.skipped.push(eligibilitySkip);
        continue;
      }

      if (await isInternalAlmanacSession(candidate, internalSessionIds)) {
        summary.skipped.push(
          syncSkippedSummary(candidate, "internal-almanac-session"),
        );
        continue;
      }

      if (args.mode === "sync" && !heldLocks.has(candidate.repoRoot)) {
        const locked = await acquireRepoSyncLock(candidate.repoRoot, args.now, {
          ownerPid: args.lockOwnerPid,
          isPidAlive: args.isPidAlive,
        });
        if (!locked) {
          summary.skipped.push(
            syncSkippedSummary(candidate, "sync-already-running"),
          );
          continue;
        }
        heldLocks.add(candidate.repoRoot);
      }

      const ledger = await loadLedgerForRepo(candidate.repoRoot, ledgers);
      await reconcileLedger(candidate.repoRoot, ledger, args.now);
      const key = ledgerKey(candidate);

      const transcript = await args.readTranscriptSnapshot(candidate.transcriptPath);
      if (!transcript.ok) {
        summary.needsAttention.push(syncSkippedSummary(candidate, transcript.reason));
        continue;
      }
      const entry = ledger.sessions[key] ??
        freshLedgerEntry(candidate, transcript.snapshot.content, args.syncSince);

      const decision = evaluateSyncCursor(entry, transcript.snapshot);
      ledger.sessions[key] = decision.kind === "needs_attention"
        ? decision.entry
        : entry;

      if (decision.kind === "skip") {
        summary.skipped.push(syncSkippedSummary(candidate, decision.reason));
        continue;
      }
      if (decision.kind === "needs_attention") {
        summary.needsAttention.push(syncSkippedSummary(candidate, decision.reason));
        continue;
      }

      summary.eligible += 1;
      if (args.mode === "status") {
        summary.ready.push(syncReadySummary(candidate, decision));
        continue;
      }

      const enqueue = await enqueueAbsorb({
        candidate,
        entry,
        decision,
        snapshot: transcript.snapshot,
        now: args.now,
        startAbsorb: args.startAbsorb,
      });
      if (!enqueue.ok) {
        ledger.sessions[key] = enqueue.entry;
        summary.needsAttention.push(syncSkippedSummary(candidate, enqueue.reason));
        await writeLedger(candidate.repoRoot, ledger, args.now);
        continue;
      }
      ledger.sessions[key] = enqueue.entry;
      await writeLedger(candidate.repoRoot, ledger, args.now);
      summary.started.push(
        syncStartedSummary(candidate, enqueue.jobId, decision),
      );
    }

    if (args.mode === "sync") {
      for (const [repoRoot, ledger] of ledgers) {
        await writeLedger(repoRoot, ledger, args.now);
      }
    }
  } finally {
    await Promise.all([...heldLocks].map(releaseRepoSyncLock));
  }

  return summary;
}

async function isInternalAlmanacSession(
  candidate: TranscriptCandidate,
  cache: Map<string, Set<string>>,
): Promise<boolean> {
  let ids = cache.get(candidate.repoRoot);
  if (ids === undefined) {
    ids = new Set(
      (await listJobRecords(candidate.repoRoot))
        .map((record) => record.providerSessionId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
    cache.set(candidate.repoRoot, ids);
  }
  return ids.has(candidate.sessionId);
}

function candidateEligibility(
  candidate: TranscriptCandidate,
  args: {
    syncSince: Date | null;
    quietMs: number;
    now: Date;
  },
): SyncSkipped | null {
  if (args.syncSince !== null && candidate.mtimeMs < args.syncSince.getTime()) {
    return syncSkippedSummary(candidate, "before-automation-activation");
  }

  const quietForMs = args.now.getTime() - candidate.mtimeMs;
  if (quietForMs < args.quietMs) {
    return syncSkippedSummary(candidate, "quiet-window");
  }
  return null;
}

async function enqueueAbsorb(args: {
  candidate: TranscriptCandidate;
  entry: LedgerEntry;
  decision: Extract<SyncCursorDecision, { kind: "ready" }>;
  snapshot: TranscriptSnapshot;
  now: Date;
  startAbsorb: StartSyncAbsorbFn;
}): Promise<
  | { ok: true; jobId: string; entry: LedgerEntry }
  | { ok: false; reason: string; entry: LedgerEntry }
> {
  const result = await args.startAbsorb({
    candidate: args.candidate,
    contextNote: syncCursorContext({
      candidate: args.candidate,
      fromLine: args.decision.fromLine,
      lastAbsorbedLine: args.entry.lastAbsorbedLine,
      lastAbsorbedSize: args.entry.lastAbsorbedSize,
    }),
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: "absorb-start-failed",
      entry: failedLedgerEntry(args.entry, result.error),
    };
  }
  return {
    ok: true,
    jobId: result.jobId,
    entry: pendingLedgerEntry({
      entry: args.entry,
      snapshot: args.snapshot,
      jobId: result.jobId,
      now: args.now,
    }),
  };
}
