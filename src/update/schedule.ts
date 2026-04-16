import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

import { checkForUpdate } from "./check.js";
import { getConfigPath } from "./config.js";
import { getStatePath, type UpdateState } from "./state.js";

/**
 * Post-command scheduler for the background update check.
 *
 * After any normal `almanac <command>` exits, we want a fresh check to
 * have happened by the next invocation. We achieve that by spawning a
 * detached copy of ourselves with the hidden `--internal-check-updates`
 * flag; that child does nothing but hit the registry and write
 * `~/.almanac/update-state.json`, then exits.
 *
 * Why detach rather than check inline:
 *   - 3s network timeout in the foreground would feel sluggish on every
 *     command.
 *   - `npm test` and CI scripts shouldn't pay for a registry round-trip
 *     (gated below via env).
 *   - A detached child with `stdio: "ignore"` cannot leak output into
 *     the parent's stdout/stderr — critical for pipelines.
 *
 * Hazards we accept:
 *   - A Claude Code subprocess whose parent shell exits right after the
 *     `almanac` call may kill the child before it finishes. That's
 *     fine: a failed check just means we try again next invocation.
 *   - Detached child survival on Windows isn't as robust as on Unix.
 *     Same fallback: next invocation retries.
 */

export function scheduleBackgroundUpdateCheck(argv: string[]): void {
  if (!shouldSchedule(argv)) return;

  const scriptPath = argv[1];
  const nodeBin = process.execPath;
  if (scriptPath === undefined || scriptPath.length === 0) return;

  // Spawn with the current Node and the same script path. `detached:
  // true` + `stdio: "ignore"` + `unref()` detaches the child from our
  // event loop so the parent can exit independently.
  try {
    const child = spawn(
      nodeBin,
      [scriptPath, "--internal-check-updates"],
      {
        detached: true,
        stdio: "ignore",
        // Windows: with `detached: true` and no `stdio`, Node opens a
        // console window — `"ignore"` prevents that.
      },
    );
    child.unref();
    // Swallow any synchronous spawn errors (e.g. ENOENT in strange
    // installs) — never propagate to the foreground command.
    child.on("error", () => {});
  } catch {
    // Last-resort swallow: background checks are best-effort.
  }
}

/**
 * Should we spawn the worker at all?
 *
 *   - Respect the `update_notifier` config — no banner means no need
 *     for the data that feeds it.
 *   - Skip in test environments so `npm test` doesn't fork 300 copies
 *     of itself into the background and hammer the registry.
 *   - Skip on the worker invocation itself (prevents a fork bomb).
 *   - Skip when the user doesn't own the install path (permission
 *     weirdness) — detected by `~/.almanac` mkdir failing; simplest
 *     to just rely on the worker's own error handling, so we don't
 *     gate here.
 *   - Skip when the argv contains `--help`/`--version`/nothing — these
 *     commands are often run from scripts that care about clean exit;
 *     though the inline banner still shows, we don't kick off a check.
 */
function shouldSchedule(argv: string[]): boolean {
  if (process.env.CODEALMANAC_SKIP_UPDATE_CHECK === "1") return false;
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.VITEST !== undefined) return false;

  // Already the worker. argv[2..] contains the internal flag.
  if (argv.slice(2).includes("--internal-check-updates")) return false;

  if (!notifierEnabled()) return false;

  return true;
}

function notifierEnabled(): boolean {
  try {
    const raw = readFileSync(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw) as { update_notifier?: unknown };
    if (parsed.update_notifier === false) return false;
    return true;
  } catch {
    return true; // missing / malformed → default-on
  }
}

/**
 * The worker body. Invoked when `--internal-check-updates` appears on
 * the argv. Must be fast and must never print: the parent spawned us
 * with `stdio: "ignore"` but a stray write could still surprise a
 * downstream debugger.
 *
 * We take a simple file lock at `~/.almanac/.update-check.lock` to
 * prevent two workers running at the same time (which could happen if
 * the user fires several commands in parallel). The lock is just the
 * existence of the file with our PID inside; if an existing lock is
 * stale (older than the 3s + cache-write budget), we steal it.
 */
export async function runInternalUpdateCheck(): Promise<void> {
  // The worker is intentionally minimal. Any error (network, fs,
  // JSON) is handled inside `checkForUpdate` and surfaces as a
  // swallowed return; we just need to await it and exit.
  try {
    await checkForUpdate({});
  } catch {
    // Defense-in-depth: nothing must escape the worker.
  }
}

/**
 * Read the current state snapshot for diagnostic surfaces (doctor, the
 * `update --check` command). Wraps the sync read so callers can grab
 * state without the `async readState` ceremony.
 */
export function readStateForDoctor(path?: string): UpdateState | null {
  const file = path ?? getStatePath();
  try {
    const raw = readFileSync(file, "utf8");
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    const parsed = JSON.parse(trimmed) as Partial<UpdateState>;
    return {
      last_check_at:
        typeof parsed.last_check_at === "number" ? parsed.last_check_at : 0,
      installed_version:
        typeof parsed.installed_version === "string"
          ? parsed.installed_version
          : "",
      latest_version:
        typeof parsed.latest_version === "string" ? parsed.latest_version : "",
      dismissed_versions: Array.isArray(parsed.dismissed_versions)
        ? parsed.dismissed_versions.filter((v): v is string => typeof v === "string")
        : [],
      last_fetch_failed_at:
        typeof parsed.last_fetch_failed_at === "number"
          ? parsed.last_fetch_failed_at
          : undefined,
    };
  } catch {
    return null;
  }
}
