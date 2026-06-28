import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getRepoAlmanacDir } from "../wiki-files/repo-location.js";
import type { IsPidAlive } from "../../shared/pid-liveness.js";

const SYNC_LOCK_STALE_MS = 60 * 60 * 1000;

export function syncLockPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "jobs", "sync.lock");
}

export interface SyncLockRuntime {
  ownerPid: number;
  isPidAlive: IsPidAlive;
}

function legacySyncLockPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs", "sync.lock");
}

function existingSyncLockPath(repoRoot: string): string {
  const primary = syncLockPath(repoRoot);
  if (existsSync(primary)) return primary;
  const legacy = legacySyncLockPath(repoRoot);
  return existsSync(legacy) ? legacy : primary;
}

export async function acquireRepoSyncLock(
  repoRoot: string,
  now: Date,
  runtime: SyncLockRuntime,
): Promise<boolean> {
  if (await tryCreateRepoLock(repoRoot, now, runtime.ownerPid)) return true;
  if (!await isStaleRepoLock(repoRoot, now, runtime.isPidAlive)) return false;
  await releaseRepoSyncLock(repoRoot);
  return await tryCreateRepoLock(repoRoot, now, runtime.ownerPid);
}

export async function releaseRepoSyncLock(repoRoot: string): Promise<void> {
  await rm(syncLockPath(repoRoot), { recursive: true, force: true });
  await rm(legacySyncLockPath(repoRoot), { recursive: true, force: true });
}

function lockOwnerPath(repoRoot: string): string {
  return join(existingSyncLockPath(repoRoot), "owner.json");
}

async function tryCreateRepoLock(
  repoRoot: string,
  now: Date,
  ownerPid: number,
): Promise<boolean> {
  try {
    const lock = syncLockPath(repoRoot);
    await mkdir(dirname(lock), { recursive: true });
    await mkdir(lock, { recursive: false });
    await writeFile(
      lockOwnerPath(repoRoot),
      `${JSON.stringify({ pid: ownerPid, startedAt: now.toISOString() }, null, 2)}\n`,
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
}

async function isStaleRepoLock(
  repoRoot: string,
  now: Date,
  isPidAlive: IsPidAlive,
): Promise<boolean> {
  let raw: Record<string, unknown> = {};
  try {
    raw = parseJsonObject(await readFile(lockOwnerPath(repoRoot), "utf8")) ?? {};
  } catch {
    return true;
  }
  const startedAt = typeof raw.startedAt === "string" ? Date.parse(raw.startedAt) : NaN;
  if (!Number.isFinite(startedAt)) return true;
  if (now.getTime() - startedAt > SYNC_LOCK_STALE_MS) return true;
  const pid = typeof raw.pid === "number" ? raw.pid : null;
  return pid !== null && !isPidAlive(pid);
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
