import { createRequire } from "node:module";

import { readState, writeState, type UpdateState } from "./state.js";

/**
 * Background update check. Called by the detached worker (`--internal-
 * check-updates`) after any normal command exits; also reachable via
 * `almanac update --check` for a synchronous "am I current?" readout.
 *
 * Contract:
 *   - Reads `~/.almanac/update-state.json` if present.
 *   - If the last check is older than `cacheSeconds` (default 24h), queries
 *     the npm registry for `codealmanac`'s `dist-tags.latest` and writes a
 *     new state file.
 *   - Network timeout is 3s: registry flakes must not prevent a check
 *     cycle on the next invocation.
 *   - All errors are swallowed; the returned state is always a usable
 *     snapshot (possibly the old one when the fetch failed).
 *
 * The fetch function is injectable. Tests pass a stub; production uses
 * the native `globalThis.fetch`. No dependency on `node-fetch`.
 */

export interface CheckOptions {
  /** Override the installed version (prod: read from package.json). */
  installedVersion?: string;
  /** Cache window; no registry call if last check is newer than this. */
  cacheSeconds?: number;
  /** Network timeout in ms (default 3000). */
  timeoutMs?: number;
  /** Clock. Tests inject to make "24h ago" deterministic. */
  now?: () => number;
  /** Fetch function (default `globalThis.fetch`). */
  fetchFn?: typeof fetch;
  /** Override the state file path (tests point it at a tmpdir). */
  statePath?: string;
  /** Force a registry call regardless of the cache. Used by `update --check`. */
  force?: boolean;
}

export interface CheckResult {
  /** The state after the check (either refreshed or unchanged). */
  state: UpdateState;
  /** True when a registry call actually happened this run. */
  fetched: boolean;
  /** True when the registry call failed (network / timeout / parse). */
  fetchFailed: boolean;
}

const DEFAULT_CACHE_SECONDS = 24 * 60 * 60;
const DEFAULT_TIMEOUT_MS = 3000;
const REGISTRY_URL = "https://registry.npmjs.org/codealmanac";

export async function checkForUpdate(
  opts: CheckOptions = {},
): Promise<CheckResult> {
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const cacheSeconds = opts.cacheSeconds ?? DEFAULT_CACHE_SECONDS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const installed = opts.installedVersion ?? readInstalledVersion();

  const state = await readState(opts.statePath);

  // Cache gate. Skip the registry call when the previous check is
  // fresh enough, unless `force: true` (used by `update --check` so
  // the user can see real-time status without waiting out the window).
  if (
    !opts.force &&
    state.last_check_at > 0 &&
    now() - state.last_check_at < cacheSeconds
  ) {
    return { state, fetched: false, fetchFailed: false };
  }

  // Query the registry with a hard timeout. `AbortController` is the
  // idiomatic Node 20+ way to bound a fetch; `setTimeout` fires abort,
  // `clearTimeout` cancels if fetch resolves first.
  let latest: string | null = null;
  let failed = false;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchFn(REGISTRY_URL, {
        signal: ac.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        failed = true;
      } else {
        const body = (await res.json()) as {
          ["dist-tags"]?: { latest?: unknown };
        };
        const tag = body["dist-tags"]?.latest;
        if (typeof tag === "string" && tag.length > 0) {
          latest = tag;
        } else {
          failed = true;
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    failed = true;
  }

  if (failed || latest === null) {
    // Record the failure but DON'T clobber the previous latest_version —
    // an offline check shouldn't make us forget that 0.1.6 is out.
    const next: UpdateState = {
      ...state,
      // We still bump last_check_at on a failed attempt; without this,
      // every subsequent command would re-try the registry. A one-shot
      // retry on the next invocation is enough; sustained failure gets
      // retried on the 24h cadence like a success.
      last_check_at: now(),
      installed_version: installed,
      last_fetch_failed_at: now(),
    };
    try {
      await writeState(next, opts.statePath);
    } catch {
      // Even the state write failed (permissions, disk full). Return
      // whatever we have — the CLI doesn't care.
    }
    return { state: next, fetched: true, fetchFailed: true };
  }

  const next: UpdateState = {
    last_check_at: now(),
    installed_version: installed,
    latest_version: latest,
    dismissed_versions: state.dismissed_versions,
    // Clear the failure marker on success.
    last_fetch_failed_at: undefined,
  };
  try {
    await writeState(next, opts.statePath);
  } catch {
    // Silent — same rationale as above.
  }
  return { state: next, fetched: true, fetchFailed: false };
}

/**
 * Read the `version` field from `package.json`. Matches the same
 * lookup strategy as `readPackageVersion` in `cli.ts` and `doctor.ts`;
 * duplicated here to keep the update module self-contained and to
 * avoid a circular import at CLI startup.
 */
function readInstalledVersion(): string {
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
