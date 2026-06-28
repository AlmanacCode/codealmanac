import {
  DEFAULT_SYNC_QUIET,
  automationTaskDefinition,
} from "./tasks.js";
import { installAutomation } from "./automation.js";
import type { AutomationInstallResult } from "./types.js";
import type { AutomationScheduler } from "../../shared/automation-scheduler.js";

export interface MigrateLegacyAutomationOptions {
  cwd: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  homeDir: string;
  legacyPlistPath?: string;
  syncPlistPath?: string;
  scheduler: AutomationScheduler;
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
  const home = options.homeDir;
  const legacyPlistPath = options.legacyPlistPath ??
    options.scheduler.defaultJobPath({
      homeDir: home,
      label: "com.codealmanac.capture-sweep",
    });
  const syncPlistPath = options.syncPlistPath ??
    options.scheduler.defaultJobPath({
      homeDir: home,
      label: automationTaskDefinition("sync").label,
    });
  const legacy = await options.scheduler.detectLegacyCaptureSweep({
    homeDir: home,
    plistPath: legacyPlistPath,
  });

  if (legacy === null) {
    return { status: "current", legacyPlistPath, syncPlistPath };
  }

  const quiet = readArgument(legacy.programArguments, "--quiet") ??
    DEFAULT_SYNC_QUIET;
  const every = legacy.intervalSeconds === null
    ? undefined
    : `${legacy.intervalSeconds}s`;
  const installed = await installAutomation({
    tasks: ["sync"],
    every,
    quiet,
    cwd: options.cwd,
    homeDir: home,
    pathEnvironment: options.pathEnvironment,
    cliProgramArguments: options.cliProgramArguments,
    plistPath: syncPlistPath,
    scheduler: options.scheduler,
  });
  if (installed.status !== "installed") {
    return { status: "install-failed", result: installed };
  }

  await options.scheduler.removeJob(legacyPlistPath);
  return {
    status: "migrated",
    legacyPlistPath,
    syncPlistPath,
    quiet,
    intervalSeconds: legacy.intervalSeconds,
  };
}

function readArgument(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] ?? null;
}
