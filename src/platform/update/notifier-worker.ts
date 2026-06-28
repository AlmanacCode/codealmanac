import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

import { checkForUpdate } from "./check.js";
import {
  getConfigPath,
  getLegacyConfigPath,
  parseConfigText,
} from "../../stores/config/index.js";

/**
 * Post-command worker for the update-notifier cache.
 *
 * This is deliberately separate from scheduled Almanac automation. It
 * only keeps `~/.almanac/update-state.json` fresh enough for the
 * pre-command banner and `doctor`; launchd/cron-style recurring tasks
 * live under `src/platform/automation/`.
 */

export function scheduleBackgroundUpdateCheck(argv: string[]): void {
  if (!shouldSchedule(argv)) return;

  const scriptPath = argv[1];
  const nodeBin = process.execPath;
  if (scriptPath === undefined || scriptPath.length === 0) return;

  try {
    const child = spawn(
      nodeBin,
      [scriptPath, "--internal-check-updates"],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    child.unref();
    child.on("error", () => {});
  } catch {
    // Background checks are best-effort.
  }
}

function shouldSchedule(argv: string[]): boolean {
  if (process.env.CODEALMANAC_SKIP_UPDATE_CHECK === "1") return false;
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.VITEST !== undefined) return false;
  if (argv.slice(2).includes("--internal-check-updates")) return false;
  if (!notifierEnabled()) return false;
  return true;
}

function notifierEnabled(): boolean {
  const parsed = readConfigSync(getConfigPath());
  if (parsed !== null) return parsed.update_notifier !== false;
  const legacy = readConfigSync(getLegacyConfigPath());
  return legacy?.update_notifier !== false;
}

function readConfigSync(path: string): { update_notifier?: unknown } | null {
  try {
    const raw = readFileSync(path, "utf8");
    return parseConfigText(raw, path) as { update_notifier?: unknown };
  } catch {
    return null;
  }
}

export async function runInternalUpdateCheck(): Promise<void> {
  try {
    await checkForUpdate({});
  } catch {
    // Nothing from the worker should escape into the foreground command.
  }
}
