import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  getConfigPath,
  getLegacyConfigPath,
  parseConfigText,
} from "./config.js";
import { isNewer } from "./semver.js";
import { getStatePath, type UpdateState } from "./state.js";

/**
 * Pre-command update-nag banner. Runs synchronously at the very top of
 * every `run()` invocation, before commander even touches argv. Prints
 * one line to stderr if:
 *
 *   1. `~/.almanac/update-state.json` exists and parses.
 *   2. `latest_version` is strictly newer than `installed_version`.
 *   3. `latest_version` is NOT in `dismissed_versions`.
 *   4. `~/.almanac/config.toml`.`update_notifier` is not `false`.
 *
 * Otherwise silent. Deliberately synchronous and filesystem-blocking:
 * this runs in the CLI critical path and waiting on a Promise would
 * force every command to become async upfront. The files are tiny
 * (<1KB each); a sync read is cheap.
 *
 * Why stderr: agents and scripts parse stdout; stderr is the
 * conventional channel for diagnostics and nags. A tool piping
 * `almanac search` into `xargs` shouldn't see the banner mixed into
 * its slug list. Users running interactively see stderr anyway, so
 * the nag is visible in practice.
 */

export interface AnnounceOptions {
  statePath?: string;
  configPath?: string;
  /** Override for tests — normally reads from package.json at import time. */
  installedVersion?: string;
  /** Enable ANSI coloring regardless of isTTY. Tests pass `false`. */
  color?: boolean;
}

const RST = "\x1b[0m";
const BOLD = "\x1b[1m";
const YELLOW = "\x1b[33m";

export function announceUpdateIfAvailable(
  stderr: NodeJS.WritableStream,
  opts: AnnounceOptions = {},
): void {
  const statePath = opts.statePath ?? getStatePath();
  const configPath = opts.configPath ?? getConfigPath();
  const installed = opts.installedVersion ?? readInstalledVersion();

  // Config gate. Must be checked before state: a user who disabled the
  // notifier shouldn't pay even a state-file read.
  if (!shouldNotify(configPath)) return;

  const state = readStateSync(statePath);
  if (state === null) return;
  if (state.latest_version.length === 0) return;
  if (!isNewer(state.latest_version, installed)) return;
  if (state.dismissed_versions.includes(state.latest_version)) return;

  const useColor =
    opts.color ?? (process.stderr.isTTY === true && !("NO_COLOR" in process.env));
  const warn = useColor ? `${YELLOW}${BOLD}\u26a0${RST}` : "!";
  const cmd = useColor ? `${BOLD}almanac update${RST}` : "almanac update";
  stderr.write(
    `${warn} Almanac ${state.latest_version} available ` +
      `(you're on ${installed}) — run: ${cmd}\n`,
  );
}

/**
 * Sync-read the state file. Returns `null` when missing, empty, or
 * malformed — the announce path MUST NOT throw into the CLI critical
 * path. Avoids the `async readState` used by the worker because
 * `run()` would otherwise need `await announceUpdateIfAvailable(...)`
 * on every invocation, which turns into a multi-millisecond penalty
 * on commands that don't care.
 */
function readStateSync(path: string): UpdateState | null {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
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
        ? parsed.dismissed_versions.filter(
            (v): v is string => typeof v === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

function shouldNotify(configPath: string): boolean {
  const loaded = readConfigSync(configPath);
  if (loaded === null) {
    const legacy = configPath.endsWith(".toml") ? readConfigSync(getLegacyConfigPath()) : null;
    if (legacy === null) return true; // no config file → default notify on
    return legacy.update_notifier !== false;
  }
  return loaded.update_notifier !== false;
}

function readConfigSync(configPath: string): { update_notifier?: unknown } | null {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    return parseConfigText(trimmed, configPath) as {
      update_notifier?: unknown;
    };
  } catch {
    return null;
  }
}

function readInstalledVersion(): string {
  // Dev: `src/update/announce.ts` → `../../package.json`. Bundled:
  // `dist/codealmanac.js` → `../package.json`. Try both.
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through.
  }
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through.
  }
  return "unknown";
}
