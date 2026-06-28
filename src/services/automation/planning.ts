import path from "node:path";

import {
  DEFAULT_AUTOMATION_TASK_IDS,
  DEFAULT_GARDEN_INTERVAL,
  DEFAULT_SYNC_INTERVAL,
  DEFAULT_SYNC_QUIET,
  DEFAULT_UPDATE_INTERVAL,
  gardenProgramArguments,
  syncProgramArguments,
  automationTaskDefinition,
  type AutomationTaskDefinition,
  updateProgramArguments,
} from "./tasks.js";
import { findNearestAlmanacDir } from "../../paths.js";
import { parseDuration } from "../../shared/duration.js";
import type {
  AutomationTaskId,
  AutomationInstallOptions,
} from "./types.js";
import type {
  AutomationScheduler,
  AutomationSchedulerJob,
} from "./scheduler.js";

export interface PlannedAutomationJob {
  task: AutomationTaskDefinition;
  intervalInput: string;
  job: AutomationSchedulerJob;
}

export interface AutomationInstallPlan {
  jobs: PlannedAutomationJob[];
  disabledGardenPlistPath: string | null;
}

export function buildAutomationInstallPlan(
  options: AutomationInstallOptions,
  scheduler: AutomationScheduler,
): { ok: true; value: AutomationInstallPlan } | { ok: false; error: string } {
  const explicitTasks = options.tasks !== undefined && options.tasks.length > 0;
  if (explicitTasks && options.gardenOff === true) {
    return {
      ok: false,
      error: "--garden-off can only be used with the default automation install",
    };
  }
  if (explicitTasks && options.tasks!.length > 1 && options.every !== undefined) {
    return {
      ok: false,
      error: "--every can only target one explicit automation task at a time",
    };
  }

  const taskIds = selectedTaskIds(options.tasks, true)
    .filter((id) => !(id === "garden" && options.gardenOff === true));
  const home = options.homeDir;
  const jobs: PlannedAutomationJob[] = [];

  for (const taskId of taskIds) {
    const task = automationTaskDefinition(taskId);
    if (taskId === "sync") {
      const quiet = parseQuiet(options.quiet ?? DEFAULT_SYNC_QUIET);
      if (!quiet.ok) return quiet;
    }
    const intervalInput = intervalInputForTask(taskId, options, explicitTasks);
    const interval = parseInterval(intervalInput);
    if (!interval.ok) return interval;
    jobs.push({
      task,
      intervalInput,
      job: scheduler.buildJob({
        taskId: task.id,
        homeDir: home,
        plistPath: plistPathForTask(task, home, options, scheduler),
        label: task.label,
        programArguments: programArgumentsForTask(task, options),
        intervalSeconds: interval.seconds,
        pathEnvironment: options.pathEnvironment,
        workingDirectory: resolveTaskWorkingDirectory(task, options.cwd),
        stdoutLogName: task.stdoutLogName,
        stderrLogName: task.stderrLogName,
      }),
    });
  }

  return {
    ok: true,
    value: {
      jobs,
      disabledGardenPlistPath:
        options.gardenOff === true && !explicitTasks
          ? plistPathForTask(automationTaskDefinition("garden"), home, options, scheduler)
          : null,
    },
  };
}

export function selectedTaskIds(
  tasks: AutomationTaskId[] | undefined,
  forInstall: boolean,
): AutomationTaskId[] {
  if (tasks !== undefined && tasks.length > 0) return dedupeTaskIds(tasks);
  return forInstall
    ? [...DEFAULT_AUTOMATION_TASK_IDS]
    : ["sync", "garden", "update"];
}

export function plistPathForTask(
  task: AutomationTaskDefinition,
  home: string,
  options: Pick<
    AutomationInstallOptions,
    "plistPath" | "gardenPlistPath" | "updatePlistPath"
  >,
  scheduler: AutomationScheduler,
): string {
  if (task.id === "sync") {
    return scheduler.defaultJobPath({
      homeDir: home,
      label: task.label,
      plistPath: options.plistPath,
    });
  }
  if (task.id === "garden") {
    return scheduler.defaultJobPath({
      homeDir: home,
      label: task.label,
      plistPath: options.gardenPlistPath,
    });
  }
  return scheduler.defaultJobPath({
    homeDir: home,
    label: task.label,
    plistPath: options.updatePlistPath,
  });
}

function dedupeTaskIds(tasks: AutomationTaskId[]): AutomationTaskId[] {
  const result: AutomationTaskId[] = [];
  for (const task of tasks) {
    if (!result.includes(task)) result.push(task);
  }
  return result;
}

function intervalInputForTask(
  task: AutomationTaskId,
  options: AutomationInstallOptions,
  explicitTasks: boolean,
): string {
  if (task === "sync") return options.every ?? DEFAULT_SYNC_INTERVAL;
  if (task === "garden") {
    return options.gardenEvery ??
      (explicitTasks ? options.every ?? DEFAULT_GARDEN_INTERVAL : DEFAULT_GARDEN_INTERVAL);
  }
  return options.every ?? DEFAULT_UPDATE_INTERVAL;
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
  return findNearestAlmanacDir(cwd) ?? path.resolve(cwd);
}

function parseInterval(value: string): { ok: true; seconds: number } | { ok: false; error: string } {
  try {
    const seconds = parseDuration(value);
    if (seconds <= 0) {
      return { ok: false, error: "automation interval must be greater than zero" };
    }
    return { ok: true, seconds };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseQuiet(value: string): { ok: true } | { ok: false; error: string } {
  try {
    const seconds = parseDuration(value);
    if (seconds < 0) {
      return { ok: false, error: "quiet window must be zero or greater" };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
