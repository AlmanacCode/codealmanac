import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  readInstallRuntimeSync,
  sameExecutablePath,
} from "./install/launcher-runtime.js";

/**
 * Check whether the `better-sqlite3` native binding is compatible with
 * the currently-running Node version. Called once at startup — before any
 * commander setup or wiki code runs — so users see a clear, actionable
 * error instead of a cryptic `NODE_MODULE_VERSION` stack trace deep inside
 * the indexer.
 *
 * Returns `null` when the binding loads cleanly (happy path). Returns a
 * human-readable error string when the binding fails; the caller writes
 * it to stderr and exits 1.
 *
 * **Why this exists (bug #3 from codealmanac-known-bugs.md):**
 *
 * `better-sqlite3` uses the old V8 ABI (not N-API). When a user switches
 * Node versions via nvm/volta/fnm, the prebuilt native binding compiled
 * for the old version fails under the new one. Node 21 (EOL) has no
 * prebuilt binary at all, so even a fresh install can fail there.
 *
 * The guard catches this at the entry point and emits two actionable lines:
 *   1. What went wrong (was installed for Node ABI X, running ABI Y)
 *   2. The exact command to fix it (`npm rebuild better-sqlite3`)
 */
export function checkSqliteAbi(): string | null {
  const req = createRequire(import.meta.url);
  try {
    // Open an in-memory DB — the cheapest proof that the native binding
    // loads. `:memory:` doesn't touch disk; we close immediately.
    const Database = req("better-sqlite3") as typeof import("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return null; // All good.
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const firstLine = msg.split("\n")[0] ?? msg;

    // Extract ABI version numbers from the error message when present.
    // NODE_MODULE_VERSION errors read: "Expected N, got M".
    const versionMatch = firstLine.match(/Expected (\d+), got (\d+)/);
    const detail = versionMatch
      ? ` (built for Node ABI ${versionMatch[1]}, running ABI ${versionMatch[2]})`
      : `: ${firstLine}`;

    // Find the codealmanac install directory so the `npm rebuild` hint
    // points at the right place. Walk up from this module's location.
    const installDir = detectInstallDir();

    const runtime = readInstallRuntimeSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    );
    const launcherHint =
      runtime !== null && !sameExecutablePath(runtime.nodePath, process.execPath)
        ? (
            `\n\nRunning Node:\n` +
            `  ${process.execPath} ${process.version}\n\n` +
            `Install-time Node:\n` +
            `  ${runtime.nodePath} ${runtime.nodeVersion}` +
            `${runtime.nodeAbi !== null ? ` (ABI ${runtime.nodeAbi})` : ""}\n\n` +
            `Repair:\n` +
            `  run the installed almanac launcher, or reinstall:\n` +
            `  npm install -g codealmanac@latest`
          )
        : "";

    return (
      `better-sqlite3 native binding failed${detail}.\n` +
      `  Fix: cd "${installDir}" && npm rebuild better-sqlite3\n` +
      `  Or switch back to the Node version it was compiled for: nvm use <version>` +
      launcherHint
    );
  }
}

/**
 * Walk up from this module's file to the nearest directory that contains
 * `package.json` with `"name": "codealmanac"`. Falls back to a generic
 * description when the walk fails (unusual install layout or bundled).
 */
function detectInstallDir(): string {
  try {
    const here = fileURLToPath(import.meta.url);
    const req = createRequire(import.meta.url);
    let dir = path.dirname(here);
    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(dir, "package.json");
      try {
        const raw = req("fs").readFileSync(pkgPath, "utf-8") as string;
        const pkg = JSON.parse(raw) as { name?: unknown };
        if (pkg.name === "codealmanac") return dir;
      } catch {
        // keep walking
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // import.meta.url unavailable or fs broken — use fallback.
  }
  // Generic fallback: point at the typical global install location.
  return path.join(
    homedir(),
    ".nvm/versions/node",
    process.version,
    "lib/node_modules/codealmanac",
  );
}
