import { homedir } from "node:os";
import path from "node:path";

import { buildLaunchPath } from "../../platform/automation/launchd.js";
import {
  DEFAULT_AUTOMATION_TASK_IDS,
  DEFAULT_GARDEN_INTERVAL,
  DEFAULT_SYNC_INTERVAL,
  DEFAULT_SYNC_QUIET,
  DEFAULT_UPDATE_INTERVAL,
  defaultGardenPlistPath,
  defaultSyncPlistPath,
  defaultUpdatePlistPath,
  scheduledTaskDefinition,
  scheduledTaskLogPaths,
  type ScheduledTaskDefinition,
  type ScheduledTaskId,
} from "../../platform/automation/tasks.js";
import { findNearestAlmanacDir } from "../../paths.js";
import { parseDuration } from "../../shared/duration.js";
import type {
  AutomationInstallOptions,
} from "./types.js";

export interface PlannedAutomationJob {
  task: ScheduledTaskDefinition;
  intervalInput: string;
  job: import("../../platform/automation/launchd.js").LaunchdJobDefinition;
}

export interface AutomationInstallPlan {
  jobs: PlannedAutomationJob[];
  disabledGardenPlistPath: string | null;
}

export function buildAutomationInstallPlan(
  options: AutomationInstallOptions,
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
  const home = options.homeDir ?? homedir();
  const environmentVariables = {
    PATH: buildLaunchPath(home, options.env?.PATH ?? process.env.PATH),
  };
  const cwd = options.cwd ?? process.cwd();
  const jobs: PlannedAutomationJob[] = [];

  for (const taskId of taskIds) {
    const task = scheduledTaskDefinition(taskId);
    if (taskId === "sync") {
      const quiet = parseQuiet(options.quiet ?? DEFAULT_SYNC_QUIET);
      if (!quiet.ok) return quiet;
    }
    const intervalInput = intervalInputForTask(taskId, options, explicitTasks);
    const interval = parseInterval(intervalInput);
    if (!interval.ok) return interval;
    const logs = scheduledTaskLogPaths(task, home);
    jobs.push({
      task,
      intervalInput,
      job: {
        plistPath: plistPathForTask(task, home, options),
        label: task.label,
        programArguments: programArgumentsForTask(task, options),
        intervalSeconds: interval.seconds,
        environmentVariables,
        workingDirectory: resolveTaskWorkingDirectory(task, cwd),
        stdoutPath: logs.stdoutPath,
        stderrPath: logs.stderrPath,
      },
    });
  }

  return {
    ok: true,
    value: {
      jobs,
      disabledGardenPlistPath:
        options.gardenOff === true && !explicitTasks
          ? options.gardenPlistPath ?? defaultGardenPlistPath(home)
          : null,
    },
  };
}

export function selectedTaskIds(
  tasks: ScheduledTaskId[] | undefined,
  forInstall: boolean,
): ScheduledTaskId[] {
  if (tasks !== undefined && tasks.length > 0) return dedupeTaskIds(tasks);
  return forInstall
    ? [...DEFAULT_AUTOMATION_TASK_IDS]
    : ["sync", "garden", "update"];
}

export function plistPathForTask(
  task: ScheduledTaskDefinition,
  home: string,
  options: Pick<
    AutomationInstallOptions,
    "plistPath" | "gardenPlistPath" | "updatePlistPath"
  >,
): string {
  if (task.id === "sync") return options.plistPath ?? defaultSyncPlistPath(home);
  if (task.id === "garden") return options.gardenPlistPath ?? defaultGardenPlistPath(home);
  return options.updatePlistPath ?? defaultUpdatePlistPath(home);
}

function dedupeTaskIds(tasks: ScheduledTaskId[]): ScheduledTaskId[] {
  const result: ScheduledTaskId[] = [];
  for (const task of tasks) {
    if (!result.includes(task)) result.push(task);
  }
  return result;
}

function intervalInputForTask(
  task: ScheduledTaskId,
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
  task: ScheduledTaskDefinition,
  options: AutomationInstallOptions,
): string[] {
  if (task.id === "sync") {
    return options.programArguments ??
      task.programArguments({ quiet: options.quiet ?? DEFAULT_SYNC_QUIET });
  }
  if (task.id === "garden") {
    return options.gardenProgramArguments ?? task.programArguments();
  }
  return options.updateProgramArguments ?? task.programArguments();
}

function resolveTaskWorkingDirectory(
  task: ScheduledTaskDefinition,
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
