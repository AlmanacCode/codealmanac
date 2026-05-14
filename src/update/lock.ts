import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getGlobalAlmanacDir } from "../paths.js";

export interface UpdateLock {
  path: string;
  release: () => Promise<void>;
}

export interface AcquireUpdateLockOptions {
  path?: string;
  now?: () => number;
  staleSeconds?: number;
}

const DEFAULT_STALE_SECONDS = 30 * 60;

export function getUpdateLockPath(): string {
  return join(getGlobalAlmanacDir(), ".update-install.lock");
}

export async function acquireUpdateLock(
  options: AcquireUpdateLockOptions = {},
): Promise<UpdateLock | null> {
  const path = options.path ?? getUpdateLockPath();
  const staleSeconds = options.staleSeconds ?? DEFAULT_STALE_SECONDS;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  await mkdir(dirname(path), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(path, "wx");
      await handle.writeFile(JSON.stringify({
        pid: process.pid,
        created_at: now(),
      }));
      await handle.close();
      return {
        path,
        release: async () => {
          try {
            await unlink(path);
          } catch {
            // A missing lock on release is harmless.
          }
        },
      };
    } catch (err: unknown) {
      if (!isFileExistsError(err)) throw err;
      if (attempt > 0 || !(await isStaleLock(path, staleSeconds, now))) {
        return null;
      }
      try {
        await unlink(path);
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function isStaleLock(
  path: string,
  staleSeconds: number,
  now: () => number,
): Promise<boolean> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { created_at?: unknown };
    if (typeof raw.created_at === "number") {
      return now() - raw.created_at > staleSeconds;
    }
  } catch {
    // Fall back to mtime below.
  }
  try {
    const info = await stat(path);
    return Date.now() - info.mtimeMs > staleSeconds * 1000;
  } catch {
    return true;
  }
}

function isFileExistsError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === "EEXIST"
  );
}
