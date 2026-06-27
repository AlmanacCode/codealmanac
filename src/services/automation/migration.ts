import { homedir } from "node:os";

import {
  readProgramArgumentAfter,
  removeLaunchdJob,
} from "../../platform/automation/launchd.js";
import { detectLegacyCaptureSweepAutomation } from "../../platform/automation/legacy-capture.js";
import {
  DEFAULT_SYNC_QUIET,
  defaultCapturePlistPath,
  defaultSyncPlistPath,
} from "../../platform/automation/tasks.js";
import { installAutomation } from "./automation.js";
import type { AutomationExecFn, AutomationInstallResult } from "./types.js";

export interface MigrateLegacyAutomationOptions {
  cwd: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  homeDir?: string;
  legacyPlistPath?: string;
  syncPlistPath?: string;
  exec?: AutomationExecFn;
}

export type MigrateLegacyAutomationResult =
  | {
    status: "current";
    legacyPlistPath: string;
    syncPlistPath: string;
  }
  | {
    status: "migrated";
    legacyPlistPath: string;
    syncPlistPath: string;
    quiet: string;
    intervalSeconds: number | null;
  }
  | {
    status: "install-failed";
    result: Exclude<AutomationInstallResult, { status: "installed" }>;
  };

export async function migrateLegacyAutomation(
  options: MigrateLegacyAutomationOptions,
): Promise<MigrateLegacyAutomationResult> {
  const home = options.homeDir ?? homedir();
  const legacyPlistPath = options.legacyPlistPath ?? defaultCapturePlistPath(home);
  const syncPlistPath = options.syncPlistPath ?? defaultSyncPlistPath(home);
  const legacy = await detectLegacyCaptureSweepAutomation({
    homeDir: home,
    plistPath: legacyPlistPath,
  });

  if (legacy === null) {
    return { status: "current", legacyPlistPath, syncPlistPath };
  }

  const quiet = readProgramArgumentAfter(legacy.contents, "--quiet") ??
    DEFAULT_SYNC_QUIET;
  const every = legacy.intervalSeconds === null
    ? undefined
    : `${legacy.intervalSeconds}s`;
  const installed = await installAutomation({
    tasks: ["sync"],
    every,
    quiet,
    cwd: options.cwd,
    pathEnvironment: options.pathEnvironment,
    cliProgramArguments: options.cliProgramArguments,
    plistPath: syncPlistPath,
    exec: options.exec,
  });
  if (installed.status !== "installed") {
    return { status: "install-failed", result: installed };
  }

  await removeLaunchdJob(legacyPlistPath, options.exec);
  return {
    status: "migrated",
    legacyPlistPath,
    syncPlistPath,
    quiet,
    intervalSeconds: legacy.intervalSeconds,
  };
}
