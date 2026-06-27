import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { jobsDir, legacyRunsDir, listJobRecords } from "../stores/jobs/records.js";
import type { JobRecord } from "./types.js";

const OWNERLESS_LOCK_GRACE_MS = 30_000;

export interface JobWorkerLock {
  path: string;
  release(): Promise<void>;
}

export function jobWorkerLockPath(repoRoot: string): string {
  return join(jobsDir(repoRoot), "worker.lock");
}

function legacyJobWorkerLockPath(repoRoot: string): string {
  return join(legacyRunsDir(repoRoot), "worker.lock");
}

export async function acquireJobWorkerLock(
  repoRoot: string,
  now: Date,
): Promise<JobWorkerLock | null> {
  if (await hasBlockingLegacyWorkerLock(repoRoot, now)) return null;
  if (await tryCreateJobWorkerLock(repoRoot, now)) {
    if (await hasBlockingLegacyWorkerLock(repoRoot, now)) {
      await releaseJobWorkerLock(repoRoot);
      return null;
    }
    return workerLock(repoRoot);
  }
  if (!await isStaleJobWorkerLock(repoRoot, now)) return null;
  await releaseJobWorkerLock(repoRoot);
  return await tryCreateJobWorkerLock(repoRoot, now) ? workerLock(repoRoot) : null;
}

export async function oldestQueuedJob(repoRoot: string): Promise<JobRecord | null> {
  const records = await listJobRecords(repoRoot);
  const queued = records.filter((record) => record.status === "queued");
  queued.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return queued[0] ?? null;
}

function workerLock(repoRoot: string): JobWorkerLock {
  const path = jobWorkerLockPath(repoRoot);
  return {
    path,
    release: () => releaseJobWorkerLock(repoRoot),
  };
}

function jobWorkerLockOwnerPath(repoRoot: string): string {
  return workerLockOwnerPath(jobWorkerLockPath(repoRoot));
}

async function tryCreateJobWorkerLock(repoRoot: string, now: Date): Promise<boolean> {
  try {
    const lock = jobWorkerLockPath(repoRoot);
    await mkdir(dirname(lock), { recursive: true });
    await mkdir(lock, { recursive: false });
    await writeFile(
      jobWorkerLockOwnerPath(repoRoot),
      `${JSON.stringify({ pid: process.pid, startedAt: now.toISOString() }, null, 2)}\n`,
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
}

async function releaseJobWorkerLock(repoRoot: string): Promise<void> {
  await releaseWorkerLockPath(jobWorkerLockPath(repoRoot));
}

async function isStaleJobWorkerLock(
  repoRoot: string,
  now: Date,
): Promise<boolean> {
  return isStaleWorkerLockPath(jobWorkerLockPath(repoRoot), now);
}

async function hasBlockingLegacyWorkerLock(repoRoot: string, now: Date): Promise<boolean> {
  const lockPath = legacyJobWorkerLockPath(repoRoot);
  if (!await workerLockExists(lockPath)) return false;
  if (!await isStaleWorkerLockPath(lockPath, now)) return true;
  await releaseWorkerLockPath(lockPath);
  return false;
}

async function workerLockExists(lockPath: string): Promise<boolean> {
  try {
    await stat(lockPath);
    return true;
  } catch {
    return false;
  }
}

function workerLockOwnerPath(lockPath: string): string {
  return join(lockPath, "owner.json");
}

async function releaseWorkerLockPath(lockPath: string): Promise<void> {
  await rm(lockPath, { recursive: true, force: true });
}

async function isStaleWorkerLockPath(
  lockPath: string,
  now: Date,
): Promise<boolean> {
  let raw: Record<string, unknown> = {};
  try {
    raw = parseJsonObject(await readFile(workerLockOwnerPath(lockPath), "utf8")) ?? {};
  } catch {
    return await isOwnerlessLockPastGrace(lockPath, now);
  }
  const pid = typeof raw.pid === "number" ? raw.pid : null;
  if (pid === null) {
    return await isOwnerlessLockPastGrace(lockPath, now);
  }
  return !isPidAlive(pid);
}

async function isOwnerlessLockPastGrace(
  lockPath: string,
  now: Date,
): Promise<boolean> {
  try {
    const lockStat = await stat(lockPath);
    return now.getTime() - lockStat.mtimeMs > OWNERLESS_LOCK_GRACE_MS;
  } catch {
    return true;
  }
}

function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
