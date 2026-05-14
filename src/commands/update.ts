import { spawn, type SpawnOptions } from "node:child_process";
import { createRequire } from "node:module";

import { checkForUpdate } from "../update/check.js";
import {
  readConfig,
  writeConfig,
  type GlobalConfig,
} from "../config/index.js";
import { isNewer } from "../update/semver.js";
import { readState, writeState } from "../update/state.js";

/**
 * `almanac update` — manual upgrade command, the counterpart to the
 * persistent nag banner.
 *
 * Default action: shell out to `npm i -g codealmanac@latest` with
 * inherited stdio so the user sees real-time download/install/permission
 * output. Synchronous in the user's terminal — no background install,
 * no mid-invocation swap (see the pair review's Tier-B design for
 * rationale).
 *
 * Flags:
 *   --dismiss — mark the current `latest_version` as "don't nag about
 *     this one again". No install. Writes state and exits.
 *   --check — force a registry query regardless of the 24h cache.
 *     Shows the result and exits. No install.
 *   --enable-notifier / --disable-notifier — deprecated compatibility
 *     flags for `config set update_notifier true|false`.
 */

export interface UpdateOptions {
  dismiss?: boolean;
  check?: boolean;
  enableNotifier?: boolean;
  disableNotifier?: boolean;

  // ─── Test injection points ──────────────────────────────────────
  /** Override state file path (tests point at a tmpdir). */
  statePath?: string;
  /** Override config file path (tests point at a tmpdir). */
  configPath?: string;
  /** Override the installed version report. */
  installedVersion?: string;
  /**
   * Replace `checkForUpdate` — tests inject a stub that returns a
   * canned state without hitting the registry.
   */
  checkFn?: typeof checkForUpdate;
  /** Replace `spawn` for tests (install path shouldn't run npm). */
  spawnFn?: typeof spawn;
  /** Clock for deterministic `last_check_at` assertions. */
  now?: () => number;
}

export interface UpdateResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runUpdate(
  opts: UpdateOptions = {},
): Promise<UpdateResult> {
  // Precedence: config toggles > --dismiss > --check > install.
  // Config toggles are disjoint from the other flags (you'd never
  // `update --dismiss --disable-notifier`), but if someone does we
  // apply them in order and take the last action as the "command"
  // that sets the exit code.
  if (opts.enableNotifier === true) {
    return await toggleNotifier(true, opts);
  }
  if (opts.disableNotifier === true) {
    return await toggleNotifier(false, opts);
  }
  if (opts.dismiss === true) {
    return await dismissLatest(opts);
  }
  if (opts.check === true) {
    return await forceCheck(opts);
  }
  return await installLatest(opts);
}

// ─── --dismiss ────────────────────────────────────────────────────

async function dismissLatest(opts: UpdateOptions): Promise<UpdateResult> {
  const state = await readState(opts.statePath);
  // Nothing to dismiss when we don't know of a newer version. Silently
  // no-op with a message — more helpful than pretending to write state
  // that no future banner would consult.
  if (state.latest_version.length === 0) {
    return {
      stdout:
        "almanac: no pending update to dismiss. " +
        "Run `almanac update --check` to query the registry.\n",
      stderr: "",
      exitCode: 0,
    };
  }
  const installed = opts.installedVersion ?? readInstalledVersion();
  if (!isNewer(state.latest_version, installed)) {
    return {
      stdout: `almanac: already on latest (${installed}); nothing to dismiss.\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  if (state.dismissed_versions.includes(state.latest_version)) {
    return {
      stdout: `almanac: ${state.latest_version} already dismissed.\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  const next = {
    ...state,
    dismissed_versions: [...state.dismissed_versions, state.latest_version],
  };
  await writeState(next, opts.statePath);
  return {
      stdout:
        `almanac: dismissed ${state.latest_version}. The nag banner ` +
        `will not show for this version.\n` +
        `Run \`almanac update\` to upgrade, or \`almanac config set update_notifier true\` to re-enable nags.\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─── --check ───────────────────────────────────────────────────────

async function forceCheck(opts: UpdateOptions): Promise<UpdateResult> {
  const installed = opts.installedVersion ?? readInstalledVersion();
  const checkFn = opts.checkFn ?? checkForUpdate;
  const result = await checkFn({
    installedVersion: installed,
    force: true,
    statePath: opts.statePath,
    now: opts.now,
  });
  if (result.fetchFailed) {
    return {
      stdout: "",
      stderr:
        `almanac: could not reach registry.npmjs.org (timeout or network error).\n` +
        `Installed: ${installed}. No cached latest available.\n`,
      exitCode: 1,
    };
  }
  const latest = result.state.latest_version;
  if (latest.length === 0) {
    return {
      stdout: `almanac: installed ${installed}; registry did not report a latest tag.\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  if (isNewer(latest, installed)) {
    const dismissed = result.state.dismissed_versions.includes(latest)
      ? " (dismissed — banner suppressed; `almanac update` still installs)"
      : "";
    return {
      stdout:
        `Almanac ${latest} available (you're on ${installed})${dismissed}.\n` +
        `Run: almanac update\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  return {
    stdout: `almanac: up to date (${installed}).\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─── --enable/--disable-notifier ──────────────────────────────────

async function toggleNotifier(
  enable: boolean,
  opts: UpdateOptions,
): Promise<UpdateResult> {
  const config = await readConfig(opts.configPath);
  const next: GlobalConfig = { ...config, update_notifier: enable };
  await writeConfig(next, opts.configPath);
  return {
    stdout:
      enable
        ? "almanac: update notifier enabled. " +
          "The pre-command banner will show when a new version is available.\n"
        : "almanac: update notifier disabled. " +
          "No more pre-command banners. Run `almanac update --check` to see status.\n",
    stderr: enable
      ? "almanac: warning: `almanac update --enable-notifier` is deprecated; use `almanac config set update_notifier true`.\n"
      : "almanac: warning: `almanac update --disable-notifier` is deprecated; use `almanac config set update_notifier false`.\n",
    exitCode: 0,
  };
}

// ─── default: install ─────────────────────────────────────────────

async function installLatest(opts: UpdateOptions): Promise<UpdateResult> {
  const spawnFn = opts.spawnFn ?? spawn;
  const installed = opts.installedVersion ?? readInstalledVersion();

  // Inherit stdio so npm's progress bar, permission prompts, and
  // peer-dep warnings land in the user's terminal verbatim. No
  // wrapping, no capture — npm output is its own contract.
  const spawnOpts: SpawnOptions = { stdio: "inherit" };

  return await new Promise<UpdateResult>((resolve) => {
    const child = spawnFn(
      "npm",
      ["i", "-g", "codealmanac@latest"],
      spawnOpts,
    );

    // Two failure modes need distinct messaging:
    //   - ENOENT: npm isn't on PATH. Rare on dev laptops, common in
    //     stripped-down CI containers. Tell the user what we tried to
    //     run so they can diagnose.
    //   - EACCES / exit code 243 / etc.: npm ran but couldn't write
    //     to the global prefix. Suggest sudo; don't try it ourselves
    //     (silently escalating privileges would be a trust violation,
    //     and the pair review explicitly rejected it).
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve({
          stdout: "",
          stderr:
            "almanac: `npm` not found on PATH. " +
            "Install Node.js + npm, or install the codealmanac package via your package manager.\n",
          exitCode: 1,
        });
        return;
      }
      resolve({
        stdout: "",
        stderr: `almanac: failed to run npm: ${err.message}\n`,
        exitCode: 1,
      });
    });

    child.on("exit", async (code, _signal) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0) {
        // Check for the common EACCES cause. npm prints "EACCES" to
        // stderr, which we don't have (inherited stdio), so we rely
        // on exit code heuristics + a generic hint.
        const hint =
          `almanac: npm install failed (exit ${exitCode}).\n` +
          `If you see "EACCES" above, try: sudo npm i -g codealmanac@latest\n` +
          `Or install with a version manager (nvm, volta, fnm) to avoid sudo.\n`;
        resolve({ stdout: "", stderr: hint, exitCode });
        return;
      }
      // On success, refresh the state file so the next command's
      // banner reflects that we're current. We can't read the new
      // version out of our own process (we're still running the old
      // build); we record what the state file's latest_version was,
      // on the assumption that npm installed that version.
      try {
        const state = await readState(opts.statePath);
        const now =
          opts.now ?? (() => Math.floor(Date.now() / 1000));
        await writeState(
          {
            last_check_at: now(),
            installed_version: state.latest_version || installed,
            latest_version: state.latest_version || installed,
            dismissed_versions: state.dismissed_versions,
          },
          opts.statePath,
        );
      } catch {
        // Non-fatal: the next `almanac` invocation will re-run the
        // background check and refresh state properly.
      }
      resolve({
        stdout: "almanac: updated.\n",
        stderr: "",
        exitCode: 0,
      });
    });
  });
}

function readInstalledVersion(): string {
  // Dev layout: `src/commands/update.ts` → `../../package.json`.
  // Bundled layout: `dist/codealmanac.js` → `../package.json`. We try
  // both so the version lookup works from both. (Same approach as
  // `cli.ts` and `doctor.ts`, which hit the same ambiguity.)
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
