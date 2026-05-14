import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { SessionCandidate, SweepApp } from "./discovery/index.js";
import { objectField, parseJsonObject, stringField } from "./discovery/jsonl.js";
import { getRepoAlmanacDir } from "../paths.js";
import { readRunRecord, runRecordPath } from "../process/records.js";
import type { RunRecord } from "../process/types.js";

export type LedgerStatus = "done" | "pending" | "failed" | "needs_attention";

export interface LedgerEntry {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  status: LedgerStatus;
  lastCapturedSize: number;
  lastCapturedLine: number;
  lastCapturedPrefixHash: string;
  lastCapturedAt?: string;
  lastRunId?: string;
  pendingToSize?: number;
  pendingToLine?: number;
  pendingPrefixHash?: string;
  pendingRunId?: string;
  pendingStartedAt?: string;
  lastError?: string;
}

export interface CaptureLedger {
  version: 1;
  updatedAt: string;
  sessions: Record<string, LedgerEntry>;
}

export interface CaptureCursor {
  size: number;
  line: number;
  prefixHash: string;
}

const EMPTY_SHA256 = `sha256:${createHash("sha256").update("").digest("hex")}`;

export async function loadLedgerForRepo(
  repoRoot: string,
  cache: Map<string, CaptureLedger>,
): Promise<CaptureLedger> {
  const cached = cache.get(repoRoot);
  if (cached !== undefined) return cached;
  const file = captureLedgerPath(repoRoot);
  let ledger: CaptureLedger;
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    ledger = isLedger(parsed) ? parsed : emptyLedger();
  } catch {
    ledger = emptyLedger();
  }
  cache.set(repoRoot, ledger);
  return ledger;
}

export async function writeLedger(
  repoRoot: string,
  ledger: CaptureLedger,
  now: Date,
): Promise<void> {
  ledger.updatedAt = now.toISOString();
  const file = captureLedgerPath(repoRoot);
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

export async function reconcileLedger(
  repoRoot: string,
  ledger: CaptureLedger,
  now: Date,
): Promise<void> {
  for (const entry of Object.values(ledger.sessions)) {
    if (entry.status !== "pending" || entry.pendingRunId === undefined) continue;
    const record = await readRunRecord(runRecordPath(repoRoot, entry.pendingRunId));
    if (record === null || record.status === "queued" || record.status === "running") {
      continue;
    }
    if (record.status === "done") {
      entry.status = "done";
      entry.lastCapturedSize = entry.pendingToSize ?? entry.lastCapturedSize;
      entry.lastCapturedLine = entry.pendingToLine ?? entry.lastCapturedLine;
      entry.lastCapturedPrefixHash = entry.pendingPrefixHash ?? entry.lastCapturedPrefixHash;
      entry.lastCapturedAt = now.toISOString();
      entry.lastRunId = entry.pendingRunId;
      clearPending(entry);
    } else {
      entry.status = "failed";
      entry.lastRunId = entry.pendingRunId;
      entry.lastError = terminalRunError(record);
      clearPending(entry);
    }
  }
}

export function freshLedgerEntry(
  candidate: SessionCandidate,
  content: Buffer,
  captureSince: Date | null,
): LedgerEntry {
  const cursor = initialLedgerCursor(content, captureSince);
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    status: "done",
    lastCapturedSize: cursor.size,
    lastCapturedLine: cursor.line,
    lastCapturedPrefixHash: cursor.prefixHash,
  };
}

export function captureCursor(content: Buffer, line: number): CaptureCursor {
  return {
    size: content.length,
    line,
    prefixHash: sha256(content),
  };
}

export function ledgerKey(candidate: Pick<SessionCandidate, "app" | "transcriptPath">): string {
  return `${candidate.app}:${candidate.transcriptPath}`;
}

export function sha256(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function countLines(content: string): number {
  if (content.length === 0) return 0;
  const matches = content.match(/\n/g);
  return (matches?.length ?? 0) + (content.endsWith("\n") ? 0 : 1);
}

function captureLedgerPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs", "capture-ledger.json");
}

function emptyLedger(): CaptureLedger {
  return { version: 1, updatedAt: new Date(0).toISOString(), sessions: {} };
}

function isLedger(value: unknown): value is CaptureLedger {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Partial<CaptureLedger>).version === 1 &&
    typeof (value as Partial<CaptureLedger>).updatedAt === "string" &&
    (value as Partial<CaptureLedger>).sessions !== null &&
    typeof (value as Partial<CaptureLedger>).sessions === "object" &&
    !Array.isArray((value as Partial<CaptureLedger>).sessions)
  );
}

function initialLedgerCursor(
  content: Buffer,
  captureSince: Date | null,
): CaptureCursor {
  if (captureSince === null || content.length === 0) {
    return { size: 0, line: 0, prefixHash: EMPTY_SHA256 };
  }
  const text = content.toString("utf8");
  let offset = 0;
  let line = 0;
  for (const rawLine of text.split(/(?<=\n)/)) {
    if (rawLine.length === 0) continue;
    const lineWithoutNewline = rawLine.replace(/\r?\n$/, "");
    const timestamp = transcriptLineTimestamp(lineWithoutNewline);
    if (timestamp !== null && timestamp >= captureSince.getTime()) {
      return {
        size: offset,
        line,
        prefixHash: offset === 0 ? EMPTY_SHA256 : sha256(content.subarray(0, offset)),
      };
    }
    offset += Buffer.byteLength(rawLine);
    line += 1;
  }
  return { size: content.length, line, prefixHash: sha256(content) };
}

function transcriptLineTimestamp(line: string): number | null {
  const parsed = parseJsonObject(line);
  if (parsed === null) return null;
  const rawTimestamp = stringField(parsed, "timestamp") ??
    stringField(objectField(parsed, "payload") ?? {}, "timestamp");
  if (rawTimestamp === undefined) return null;
  const ms = Date.parse(rawTimestamp);
  return Number.isFinite(ms) ? ms : null;
}

function terminalRunError(record: RunRecord): string {
  return record.error ?? record.failure?.message ?? `capture ${record.status}`;
}

function clearPending(entry: LedgerEntry): void {
  delete entry.pendingToSize;
  delete entry.pendingToLine;
  delete entry.pendingPrefixHash;
  delete entry.pendingRunId;
  delete entry.pendingStartedAt;
}
