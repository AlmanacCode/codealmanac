import { createHash } from "node:crypto";

import {
  transcriptCursorForSince,
  type TranscriptCandidate,
} from "../../shared/transcripts.js";
import { readJobRecord, resolveJobRecordPath } from "../../stores/jobs/records.js";
import type { JobRecord } from "../../stores/jobs/types.js";
import type {
  LedgerEntry,
  SyncCursor,
  SyncLedger,
} from "../../stores/sync/ledger.js";

export type {
  LedgerApp,
  LedgerEntry,
  LedgerStatus,
  SyncCursor,
  SyncLedger,
} from "../../stores/sync/ledger.js";

const EMPTY_SHA256 = `sha256:${createHash("sha256").update("").digest("hex")}`;

export async function reconcileLedger(
  repoRoot: string,
  ledger: SyncLedger,
  now: Date,
): Promise<void> {
  for (const entry of Object.values(ledger.sessions)) {
    if (entry.status !== "pending" || entry.pendingJobId === undefined) continue;
    const record = await readJobRecord(await resolveJobRecordPath(repoRoot, entry.pendingJobId));
    if (record === null || record.status === "queued" || record.status === "running") {
      continue;
    }
    if (record.status === "done") {
      entry.status = "done";
      entry.lastAbsorbedSize = entry.pendingToSize ?? entry.lastAbsorbedSize;
      entry.lastAbsorbedLine = entry.pendingToLine ?? entry.lastAbsorbedLine;
      entry.lastAbsorbedPrefixHash = entry.pendingPrefixHash ?? entry.lastAbsorbedPrefixHash;
      entry.lastAbsorbedAt = now.toISOString();
      entry.lastJobId = entry.pendingJobId;
      clearPending(entry);
    } else {
      entry.status = "failed";
      entry.lastJobId = entry.pendingJobId;
      entry.lastError = terminalJobError(record);
      clearPending(entry);
    }
  }
}

export function freshLedgerEntry(
  candidate: TranscriptCandidate,
  content: Buffer,
  syncSince: Date | null,
): LedgerEntry {
  const cursor = initialLedgerCursor(content, syncSince);
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    status: "done",
    lastAbsorbedSize: cursor.size,
    lastAbsorbedLine: cursor.line,
    lastAbsorbedPrefixHash: cursor.prefixHash,
  };
}

export function syncCursor(content: Buffer, line: number): SyncCursor {
  return {
    size: content.length,
    line,
    prefixHash: sha256(content),
  };
}

export function ledgerKey(candidate: Pick<TranscriptCandidate, "app" | "transcriptPath">): string {
  return `${candidate.app}:${candidate.transcriptPath}`;
}

export function sha256(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function initialLedgerCursor(
  content: Buffer,
  syncSince: Date | null,
): SyncCursor {
  if (syncSince === null || content.length === 0) {
    return { size: 0, line: 0, prefixHash: EMPTY_SHA256 };
  }
  const cursor = transcriptCursorForSince(content, syncSince);
  return {
    ...cursor,
    prefixHash: cursor.size === 0
      ? EMPTY_SHA256
      : sha256(content.subarray(0, cursor.size)),
  };
}

function terminalJobError(record: JobRecord): string {
  return record.error ?? record.failure?.message ?? `sync absorb ${record.status}`;
}

function clearPending(entry: LedgerEntry): void {
  delete entry.pendingToSize;
  delete entry.pendingToLine;
  delete entry.pendingPrefixHash;
  delete entry.pendingJobId;
  delete entry.pendingStartedAt;
}
