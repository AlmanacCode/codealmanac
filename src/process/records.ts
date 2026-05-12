import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AgentRunSpec } from "../harness/types.js";
import type { HarnessFailure } from "../harness/events.js";
import { getRepoAlmanacDir } from "../paths.js";
import type { RunRecord, RunStatus, RunSummary, RunView } from "./types.js";

export function runsDir(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs");
}

export function runRecordPath(repoRoot: string, runId: string): string {
  return join(runsDir(repoRoot), `${runId}.json`);
}

export function runLogPath(repoRoot: string, runId: string): string {
  return join(runsDir(repoRoot), `${runId}.jsonl`);
}

export function runCancelPath(repoRoot: string, runId: string): string {
  return join(runsDir(repoRoot), `${runId}.cancel`);
}

export async function markRunCancelled(
  repoRoot: string,
  runId: string,
): Promise<void> {
  const path = runCancelPath(repoRoot, runId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "cancelled\n", "utf8");
}

export function isRunCancellationRequested(
  repoRoot: string,
  runId: string,
): boolean {
  return existsSync(runCancelPath(repoRoot, runId));
}

export async function writeRunRecord(
  path: string,
  record: RunRecord,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export function buildStartedRunRecord(args: {
  runId: string;
  repoRoot: string;
  spec: AgentRunSpec;
  startedAt: Date;
  pid?: number;
}): RunRecord {
  return {
    version: 1,
    id: args.runId,
    operation: args.spec.metadata?.operation ?? "absorb",
    status: "running",
    repoRoot: args.repoRoot,
    pid: args.pid ?? process.pid,
    provider: args.spec.provider.id,
    model: args.spec.provider.model,
    startedAt: args.startedAt.toISOString(),
    logPath: runLogPath(args.repoRoot, args.runId),
    targetKind: args.spec.metadata?.targetKind,
    targetPaths: args.spec.metadata?.targetPaths,
  };
}

export function buildQueuedRunRecord(args: {
  runId: string;
  repoRoot: string;
  spec: AgentRunSpec;
  queuedAt: Date;
}): RunRecord {
  return {
    ...buildStartedRunRecord({
      runId: args.runId,
      repoRoot: args.repoRoot,
      spec: args.spec,
      startedAt: args.queuedAt,
      pid: 0,
    }),
    status: "queued",
  };
}

export function finishRunRecord(args: {
  record: RunRecord;
  status: Extract<RunStatus, "done" | "failed" | "cancelled">;
  finishedAt: Date;
  providerSessionId?: string;
  summary?: RunSummary;
  error?: string;
  failure?: HarnessFailure;
}): RunRecord {
  const started = Date.parse(args.record.startedAt);
  const finished = args.finishedAt.getTime();
  return {
    ...args.record,
    status: args.status,
    providerSessionId: args.providerSessionId ?? args.record.providerSessionId,
    finishedAt: args.finishedAt.toISOString(),
    durationMs: Number.isFinite(started)
      ? Math.max(0, finished - started)
      : undefined,
    summary: args.summary,
    error: args.error,
    failure: args.failure,
  };
}

export async function readRunRecord(path: string): Promise<RunRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return isRunRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function listRunRecords(repoRoot: string): Promise<RunRecord[]> {
  const dir = runsDir(repoRoot);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const records: RunRecord[] = [];
  for (const entry of entries) {
    if (!entry.startsWith("run_") || !entry.endsWith(".json")) continue;
    const record = await readRunRecord(join(dir, entry));
    if (record !== null) records.push(record);
  }
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function toRunView(args: {
  record: RunRecord;
  now: Date;
  isPidAlive: (pid: number) => boolean;
}): RunView {
  const started = Date.parse(args.record.startedAt);
  const finished =
    args.record.finishedAt !== undefined
      ? Date.parse(args.record.finishedAt)
      : undefined;
  const elapsedMs =
    args.record.durationMs ??
    (Number.isFinite(started)
      ? Math.max(0, (finished ?? args.now.getTime()) - started)
      : 0);
  const displayStatus =
    args.record.status === "running" && !args.isPidAlive(args.record.pid)
      ? "stale"
      : args.record.status;
  return {
    ...args.record,
    displayStatus,
    elapsedMs,
    error:
      displayStatus === "stale"
        ? "process ended without a final status"
        : args.record.error,
  };
}

export function isRunRecord(value: unknown): value is RunRecord {
  if (value === null || typeof value !== "object") return false;
  const v = value as Partial<RunRecord>;
  return (
    v.version === 1 &&
    typeof v.id === "string" &&
    v.id.startsWith("run_") &&
    (v.operation === "build" || v.operation === "absorb" || v.operation === "garden") &&
    (v.status === "queued" ||
      v.status === "running" ||
      v.status === "done" ||
      v.status === "failed" ||
      v.status === "cancelled") &&
    typeof v.repoRoot === "string" &&
    typeof v.pid === "number" &&
    (v.provider === "claude" || v.provider === "codex" || v.provider === "cursor") &&
    typeof v.startedAt === "string" &&
    typeof v.logPath === "string"
  );
}
