import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { IsPidAlive } from "../../shared/pid-liveness.js";
import { jobsDir, legacyRunsDir } from "./records.js";

const OWNERLESS_LOCK_GRACE_MS = 30_000;

export interface JobWorkerLock {
  path: string;
  release(): Promise<void>;
}

export interface JobWorkerLockRuntime {
  ownerPid: number;
  isPidAlive: IsPidAlive;
}

export function jobWorkerLockPath(repoRoot: string): string {
  return join(jobsDir(repoRoot), "worker.lock");
}

export async function acquireJobWorkerLock(
  repoRoot: string,
  now: Date,
  runtime: JobWorkerLockRuntime,
): Promise<JobWorkerLock | null> {
  if (await hasBlockingLegacyWorkerLock(repoRoot, now, runtime.isPidAlive)) {
    return null;
  }
  if (await tryCreateJobWorkerLock(repoRoot, now, runtime.ownerPid)) {
    if (await hasBlockingLegacyWorkerLock(repoRoot, now, runtime.isPidAlive)) {
      await releaseJobWorkerLock(repoRoot);
      return null;
    }
    return workerLock(repoRoot);
  }
  if (!await isStaleJobWorkerLock(repoRoot, now, runtime.isPidAlive)) return null;
  await releaseJobWorkerLock(repoRoot);
  return await tryCreateJobWorkerLock(repoRoot, now, runtime.ownerPid)
    ? workerLock(repoRoot)
    : null;
}

function legacyJobWorkerLockPath(repoRoot: string): string {
  return join(legacyRunsDir(repoRoot), "worker.lock");
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

async function tryCreateJobWorkerLock(
  repoRoot: string,
  now: Date,
  ownerPid: number,
): Promise<boolean> {
  try {
    const lock = jobWorkerLockPath(repoRoot);
    await mkdir(dirname(lock), { recursive: true });
    await mkdir(lock, { recursive: false });
    await writeFile(
      jobWorkerLockOwnerPath(repoRoot),
      `${JSON.stringify({ pid: ownerPid, startedAt: now.toISOString() }, null, 2)}\n`,
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
  isPidAlive: IsPidAlive,
): Promise<boolean> {
  return isStaleWorkerLockPath(jobWorkerLockPath(repoRoot), now, isPidAlive);
}

async function hasBlockingLegacyWorkerLock(
  repoRoot: string,
  now: Date,
  isPidAlive: IsPidAlive,
): Promise<boolean> {
  const lockPath = legacyJobWorkerLockPath(repoRoot);
  if (!await workerLockExists(lockPath)) return false;
  if (!await isStaleWorkerLockPath(lockPath, now, isPidAlive)) return true;
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
  isPidAlive: IsPidAlive,
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
