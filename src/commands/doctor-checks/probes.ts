import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  checkClaudeAuth,
  type ClaudeAuthStatus,
  type SpawnCliFn,
} from "../../agent/readiness/providers/claude/index.js";
import type { SqliteProbeResult } from "./types.js";

// Single `createRequire` instance — used by package/binding probes.
const req = createRequire(import.meta.url);

/**
 * Detect where codealmanac is installed by walking up from the running
 * module until we find a `package.json` whose `name` is `codealmanac`.
 */
export function detectInstallPath(): string | null {
  try {
    const here = fileURLToPath(import.meta.url);
    let dir = path.dirname(here);
    for (let i = 0; i < 6; i++) {
      const pkgPath = path.join(dir, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const raw = readFileSync(pkgPath, "utf-8");
          const pkg = JSON.parse(raw) as { name?: unknown };
          if (pkg.name === "codealmanac") return dir;
        } catch {
          // ignore — keep walking
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Classify the detected install path as permanent or ephemeral.
 * Ephemeral locations (npm npx cache, pnpm dlx cache, /tmp/) are valid
 * installs but will disappear when the cache is evicted or the machine
 * reboots. Doctor reports them as `info` rather than `ok`.
 */
export function classifyInstallPath(
  raw: string | null,
): { installPath: string | null; isEphemeral: boolean } {
  if (raw === null) return { installPath: null, isEphemeral: false };
  const home = homedir();
  const ephemeralPrefixes = [
    path.join(home, ".npm", "_npx"),
    path.join(home, ".local", "share", "pnpm", "dlx"),
    "/tmp/",
    "/var/folders/",
  ];
  const isEphemeral = ephemeralPrefixes.some((p) => raw.startsWith(p));
  return { installPath: raw, isEphemeral };
}

/**
 * Probe the better-sqlite3 native binding by opening an in-memory DB.
 */
export function probeBetterSqlite3(): SqliteProbeResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = req("better-sqlite3") as typeof import("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return { ok: true, summary: "native binding loads cleanly" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const firstLine = msg.split("\n")[0] ?? msg;
    return { ok: false, summary: firstLine };
  }
}

export async function safeCheckAuth(
  spawnCli?: SpawnCliFn,
): Promise<ClaudeAuthStatus> {
  try {
    return await checkClaudeAuth(spawnCli);
  } catch {
    return { loggedIn: false };
  }
}

export function readPackageVersion(): string | null {
  const candidates = [
    "../../../package.json",
    "../../package.json",
    "../package.json",
  ];
  for (const candidate of candidates) {
    try {
      const pkg = req(candidate) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch {
      // Fall through to the next runtime layout candidate.
    }
  }
  return null;
}
