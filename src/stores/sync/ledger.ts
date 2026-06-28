import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getRepoAlmanacDir } from "../../paths.js";
import { writeTextFileAtomically } from "../atomic-write.js";

export type LedgerApp = "claude" | "codex";

export type LedgerStatus = "done" | "pending" | "failed" | "needs_attention";

export interface LedgerEntry {
  app: LedgerApp;
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
  await writeTextFileAtomically(file, `${JSON.stringify(ledger, null, 2)}\n`);
}

export function syncLedgerPath(repoRoot: string): string {
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

export function emptyLedger(): SyncLedger {
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
