import { readFile } from "node:fs/promises";

import type { SessionCandidate } from "./discovery/index.js";
import {
  type LedgerEntry,
  countLines,
  sha256,
  syncCursor,
} from "./ledger.js";

export interface TranscriptSnapshot {
  content: Buffer;
  currentSize: number;
  currentLine: number;
}

export type TranscriptReadResult =
  | { ok: true; snapshot: TranscriptSnapshot }
  | { ok: false; reason: string };

export type SyncCursorDecision =
  | { kind: "skip"; reason: string }
  | { kind: "needs_attention"; reason: string; entry: LedgerEntry }
  | { kind: "ready"; fromLine: number; toLine: number };

export async function readTranscriptSnapshot(
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

export function evaluateSyncCursor(
  entry: LedgerEntry,
  snapshot: TranscriptSnapshot,
): SyncCursorDecision {
  if (entry.status === "pending") {
    return { kind: "skip", reason: "sync-already-pending" };
  }

  if (snapshot.currentSize <= entry.lastAbsorbedSize) {
    return { kind: "skip", reason: "unchanged" };
  }

  const prefixHash = sha256(snapshot.content.subarray(0, entry.lastAbsorbedSize));
  if (prefixHash !== entry.lastAbsorbedPrefixHash) {
    return {
      kind: "needs_attention",
      reason: "prefix-mismatch",
      entry: markPrefixMismatch(entry),
    };
  }

  return {
    kind: "ready",
    fromLine: entry.lastAbsorbedLine + 1,
    toLine: snapshot.currentLine,
  };
}

export function pendingLedgerEntry(args: {
  entry: LedgerEntry;
  snapshot: TranscriptSnapshot;
  jobId: string;
  now: Date;
}): LedgerEntry {
  const pendingCursor = syncCursor(args.snapshot.content, args.snapshot.currentLine);
  return {
    ...args.entry,
    status: "pending",
    pendingToSize: pendingCursor.size,
    pendingToLine: pendingCursor.line,
    pendingPrefixHash: pendingCursor.prefixHash,
    pendingJobId: args.jobId,
    pendingStartedAt: args.now.toISOString(),
    lastJobId: args.jobId,
    lastError: undefined,
  };
}

export function failedLedgerEntry(entry: LedgerEntry, error: string): LedgerEntry {
  return {
    ...entry,
    status: "failed",
    lastError: error,
  };
}

function markPrefixMismatch(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    status: "needs_attention",
    lastError: "transcript prefix no longer matches ledger cursor",
  };
}
