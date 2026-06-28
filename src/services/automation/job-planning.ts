import {
  DEFAULT_SYNC_QUIET,
  gardenProgramArguments,
  syncProgramArguments,
  type AutomationTaskDefinition,
  updateProgramArguments,
} from "./tasks.js";
import { resolveNearestWikiRootOrCwd } from "../../stores/wiki-files/repo-location.js";
import type { AutomationInstallOptions } from "./types.js";
import type {
  AutomationScheduler,
  AutomationSchedulerJob,
} from "../../shared/automation-scheduler.js";

export function buildAutomationSchedulerJob(
  task: AutomationTaskDefinition,
  options: AutomationInstallOptions,
  scheduler: AutomationScheduler,
  intervalSeconds: number,
): AutomationSchedulerJob {
  return scheduler.buildJob({
    homeDir: options.homeDir,
    plistPath: plistPathForTask(task, options.homeDir, options, scheduler),
    label: task.label,
    programArguments: programArgumentsForTask(task, options),
    intervalSeconds,
    pathEnvironment: options.pathEnvironment,
    workingDirectory: resolveTaskWorkingDirectory(task, options.cwd),
    stdoutLogName: task.stdoutLogName,
    stderrLogName: task.stderrLogName,
  });
}

export function plistPathForTask(
  task: AutomationTaskDefinition,
  homeDir: string,
  options: Pick<
    AutomationInstallOptions,
    "plistPath" | "gardenPlistPath" | "updatePlistPath"
  >,
  scheduler: AutomationScheduler,
): string {
  if (task.id === "sync") {
    return scheduler.defaultJobPath({
      homeDir,
      label: task.label,
      plistPath: options.plistPath,
    });
  }
  if (task.id === "garden") {
    return scheduler.defaultJobPath({
      homeDir,
      label: task.label,
      plistPath: options.gardenPlistPath,
    });
  }
  return scheduler.defaultJobPath({
    homeDir,
    label: task.label,
    plistPath: options.updatePlistPath,
  });
}

function programArgumentsForTask(
  task: AutomationTaskDefinition,
  options: AutomationInstallOptions,
): string[] {
  if (task.id === "sync") {
    return options.programArguments ??
      syncProgramArguments(
        options.cliProgramArguments,
        options.quiet ?? DEFAULT_SYNC_QUIET,
      );
  }
  if (task.id === "garden") {
    return options.gardenProgramArguments ??
      gardenProgramArguments(options.cliProgramArguments);
  }
  return options.updateProgramArguments ??
    updateProgramArguments(options.cliProgramArguments);
}

function resolveTaskWorkingDirectory(
  task: AutomationTaskDefinition,
  cwd: string,
): string | undefined {
  if (task.workingDirectory === "none") return undefined;
  return resolveNearestWikiRootOrCwd(cwd);
}
