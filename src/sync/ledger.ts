import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { SessionCandidate, SweepApp } from "./discovery/index.js";
import { objectField, parseJsonObject, stringField } from "./discovery/jsonl.js";
import { getRepoAlmanacDir } from "../paths.js";
import { readJobRecord, resolveJobRecordPath } from "../stores/jobs/records.js";
import type { JobRecord } from "../jobs/types.js";

export type LedgerStatus = "done" | "pending" | "failed" | "needs_attention";

export interface LedgerEntry {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  status: LedgerStatus;
  lastAbsorbedSize: number;
  lastAbsorbedLine: number;
  lastAbsorbedPrefixHash: string;
  lastAbsorbedAt?: string;
  lastJobId?: string;
  pendingToSize?: number;
  pendingToLine?: number;
  pendingPrefixHash?: string;
  pendingJobId?: string;
  pendingStartedAt?: string;
  lastError?: string;
}

export interface SyncLedger {
  version: 1;
  updatedAt: string;
  sessions: Record<string, LedgerEntry>;
}

export interface SyncCursor {
  size: number;
  line: number;
  prefixHash: string;
}

const EMPTY_SHA256 = `sha256:${createHash("sha256").update("").digest("hex")}`;

export async function loadLedgerForRepo(
  repoRoot: string,
  cache: Map<string, SyncLedger>,
): Promise<SyncLedger> {
  const cached = cache.get(repoRoot);
  if (cached !== undefined) return cached;
	  let ledger: SyncLedger;
	  try {
	    const parsed = JSON.parse(await readFile(existingLedgerPath(repoRoot), "utf8")) as unknown;
	    ledger = normalizeLedger(parsed) ?? emptyLedger();
	  } catch {
	    ledger = emptyLedger();
	  }
  cache.set(repoRoot, ledger);
  return ledger;
}

export async function writeLedger(
  repoRoot: string,
  ledger: SyncLedger,
  now: Date,
): Promise<void> {
  ledger.updatedAt = now.toISOString();
  const file = syncLedgerPath(repoRoot);
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

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
  candidate: SessionCandidate,
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

function syncLedgerPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "jobs", "sync-ledger.json");
}

function legacySyncLedgerPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs", "sync-ledger.json");
}

function legacyCaptureLedgerPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs", "capture-ledger.json");
}

function existingLedgerPath(repoRoot: string): string {
  for (const candidate of [
    syncLedgerPath(repoRoot),
    legacySyncLedgerPath(repoRoot),
    legacyCaptureLedgerPath(repoRoot),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return syncLedgerPath(repoRoot);
}

function emptyLedger(): SyncLedger {
  return { version: 1, updatedAt: new Date(0).toISOString(), sessions: {} };
}

function normalizeLedger(value: unknown): SyncLedger | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.updatedAt !== "string") return null;
  if (raw.sessions === null || typeof raw.sessions !== "object" || Array.isArray(raw.sessions)) {
    return null;
  }
  const sessions: Record<string, LedgerEntry> = {};
  for (const [key, entry] of Object.entries(raw.sessions)) {
    const normalized = normalizeLedgerEntry(entry);
    if (normalized !== null) sessions[key] = normalized;
  }
  return { version: 1, updatedAt: raw.updatedAt, sessions };
}

function normalizeLedgerEntry(value: unknown): LedgerEntry | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const app = raw.app === "claude" || raw.app === "codex" ? raw.app : null;
  const sessionId = stringValue(raw.sessionId);
  const transcriptPath = stringValue(raw.transcriptPath);
  const status = ledgerStatus(raw.status);
  const lastAbsorbedSize = numberValue(raw.lastAbsorbedSize) ?? numberValue(raw.lastCapturedSize);
  const lastAbsorbedLine = numberValue(raw.lastAbsorbedLine) ?? numberValue(raw.lastCapturedLine);
  const lastAbsorbedPrefixHash =
    stringValue(raw.lastAbsorbedPrefixHash) ?? stringValue(raw.lastCapturedPrefixHash);
  if (
    app === null ||
    sessionId === null ||
    transcriptPath === null ||
    status === null ||
    lastAbsorbedSize === null ||
    lastAbsorbedLine === null ||
    lastAbsorbedPrefixHash === null
  ) {
    return null;
  }
  return optionalEntry({
    app,
    sessionId,
    transcriptPath,
    status,
    lastAbsorbedSize,
    lastAbsorbedLine,
    lastAbsorbedPrefixHash,
    lastAbsorbedAt: stringValue(raw.lastAbsorbedAt) ?? stringValue(raw.lastCapturedAt),
    lastJobId: stringValue(raw.lastJobId),
    pendingToSize: numberValue(raw.pendingToSize),
    pendingToLine: numberValue(raw.pendingToLine),
    pendingPrefixHash: stringValue(raw.pendingPrefixHash),
    pendingJobId: stringValue(raw.pendingJobId) ?? stringValue(raw.pendingRunId),
    pendingStartedAt: stringValue(raw.pendingStartedAt),
    lastError: stringValue(raw.lastError),
  });
}

function optionalEntry(entry: Record<string, unknown>): LedgerEntry {
  return Object.fromEntries(
    Object.entries(entry).filter(([, value]) => value !== null && value !== undefined),
  ) as unknown as LedgerEntry;
}

function ledgerStatus(value: unknown): LedgerStatus | null {
  return value === "done" ||
    value === "pending" ||
    value === "failed" ||
    value === "needs_attention"
    ? value
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function initialLedgerCursor(
  content: Buffer,
  syncSince: Date | null,
): SyncCursor {
  if (syncSince === null || content.length === 0) {
    return { size: 0, line: 0, prefixHash: EMPTY_SHA256 };
  }
  const text = content.toString("utf8");
  let offset = 0;
  let line = 0;
  for (const rawLine of text.split(/(?<=\n)/)) {
    if (rawLine.length === 0) continue;
    const lineWithoutNewline = rawLine.replace(/\r?\n$/, "");
    const timestamp = transcriptLineTimestamp(lineWithoutNewline);
    if (timestamp !== null && timestamp >= syncSince.getTime()) {
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
