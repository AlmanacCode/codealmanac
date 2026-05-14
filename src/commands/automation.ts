import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  bootstrapLaunchdJob,
  buildLaunchPath,
  ensureLaunchdDirs,
  type ExecFn,
  type LaunchdJobStatus,
  readLaunchdJobStatus,
  readProgramArgumentAfter,
  removeLaunchdJob,
  writeLaunchdPlist,
} from "../automation/launchd.js";
import type { LaunchdJobDefinition } from "../automation/launchd.js";
import {
  DEFAULT_AUTOMATION_TASK_IDS,
  DEFAULT_CAPTURE_INTERVAL,
  DEFAULT_CAPTURE_QUIET,
  DEFAULT_GARDEN_INTERVAL,
  DEFAULT_UPDATE_INTERVAL,
  defaultCapturePlistPath,
  defaultGardenPlistPath,
  defaultUpdatePlistPath,
  isScheduledTaskId,
  scheduledTaskDefinition,
  scheduledTaskLogPaths,
  type ScheduledTaskDefinition,
  type ScheduledTaskId,
} from "../automation/tasks.js";
import type { CommandResult } from "../cli/helpers.js";
import { ensureAutomationCaptureSince } from "../config/index.js";
import { parseDuration } from "../indexer/duration.js";
import { findNearestAlmanacDir } from "../paths.js";

export { cleanupLegacyHooks } from "../automation/legacy-hooks.js";

export interface AutomationOptions {
  tasks?: ScheduledTaskId[];
  every?: string;
  quiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  cwd?: string;
  homeDir?: string;
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  programArguments?: string[];
  gardenProgramArguments?: string[];
  updateProgramArguments?: string[];
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  now?: Date;
  configPath?: string;
}

export interface AutomationStatusOptions {
  tasks?: ScheduledTaskId[];
  homeDir?: string;
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  exec?: ExecFn;
}

interface PlannedAutomationJob {
  task: ScheduledTaskDefinition;
  intervalInput: string;
  job: LaunchdJobDefinition;
}

interface AutomationInstallPlan {
  jobs: PlannedAutomationJob[];
  disabledGardenPlistPath: string | null;
}

const TASK_LABELS: Record<ScheduledTaskId, string> = {
  capture: "auto-capture automation",
  garden: "garden automation",
  update: "auto-update automation",
};

export async function runAutomationInstall(
  options: AutomationOptions = {},
): Promise<CommandResult> {
  const plan = buildAutomationInstallPlan(options);
  if (!plan.ok) {
    return { stdout: "", stderr: `almanac: ${plan.error}\n`, exitCode: 1 };
  }

  await writeAutomationPlists(plan.value);

  const captureJob = plan.value.jobs.find((job) => job.task.id === "capture");
  const captureSince = captureJob === undefined
    ? null
    : await ensureAutomationCaptureSince(
      (options.now ?? new Date()).toISOString(),
      options.configPath,
    );
  const activated = await activateAutomationJobs(plan.value, options.exec);
  if (!activated.ok) {
    return activated.result;
  }

  return {
    stdout: formatAutomationInstall(plan.value, captureSince),
    stderr: "",
    exitCode: 0,
  };
}

export async function runAutomationUninstall(
  options: AutomationOptions = {},
): Promise<CommandResult> {
  const home = options.homeDir ?? homedir();
  const tasks = selectedTaskIds(options.tasks, false);
  const exec = options.exec;
  const removed: string[] = [];
  for (const task of tasks.map((id) => scheduledTaskDefinition(id))) {
    const plist = plistPathForTask(task, home, options);
    if (await removeLaunchdJob(plist, exec)) {
      removed.push(plist);
    }
  }
  if (removed.length > 0) {
    return {
      stdout:
        `almanac: automation removed\n` +
        removed.map((pathValue) => `  plist: ${pathValue}\n`).join(""),
      stderr: "",
      exitCode: 0,
    };
  }
  return {
    stdout: "almanac: automation not installed\n",
    stderr: "",
    exitCode: 0,
  };
}

export async function runAutomationStatus(
  options: AutomationStatusOptions = {},
): Promise<CommandResult> {
  const home = options.homeDir ?? homedir();
  const tasks = selectedTaskIds(options.tasks, false);
  const sections: string[] = [];
  for (const task of tasks.map((id) => scheduledTaskDefinition(id))) {
    const status = await readLaunchdJobStatus({
      label: task.label,
      plistPath: plistPathForTask(task, home, options),
      exec: options.exec,
    });
    sections.push(formatAutomationStatus(task, status));
  }
  return {
    stdout: sections.join(""),
    stderr: "",
    exitCode: 0,
  };
}

export function defaultPlistPath(home: string = homedir()): string {
  return defaultCapturePlistPath(home);
}

export function parseAutomationTaskIds(
  values: string[],
): { ok: true; tasks: ScheduledTaskId[] } | { ok: false; error: string } {
  const tasks: ScheduledTaskId[] = [];
  for (const value of values) {
    if (!isScheduledTaskId(value)) {
      return {
        ok: false,
        error: `unknown automation task '${value}' (expected capture, garden, or update)`,
      };
    }
    if (!tasks.includes(value)) tasks.push(value);
  }
  return { ok: true, tasks };
}

function buildAutomationInstallPlan(
  options: AutomationOptions,
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
    if (taskId === "capture") {
      const quiet = parseQuiet(options.quiet ?? DEFAULT_CAPTURE_QUIET);
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

function selectedTaskIds(
  tasks: ScheduledTaskId[] | undefined,
  forInstall: boolean,
): ScheduledTaskId[] {
  if (tasks !== undefined && tasks.length > 0) return dedupeTaskIds(tasks);
  return forInstall
    ? [...DEFAULT_AUTOMATION_TASK_IDS]
    : ["capture", "garden", "update"];
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
  options: AutomationOptions,
  explicitTasks: boolean,
): string {
  if (task === "capture") return options.every ?? DEFAULT_CAPTURE_INTERVAL;
  if (task === "garden") {
    return options.gardenEvery ??
      (explicitTasks ? options.every ?? DEFAULT_GARDEN_INTERVAL : DEFAULT_GARDEN_INTERVAL);
  }
  return options.every ?? DEFAULT_UPDATE_INTERVAL;
}

function programArgumentsForTask(
  task: ScheduledTaskDefinition,
  options: AutomationOptions,
): string[] {
  if (task.id === "capture") {
    return options.programArguments ??
      task.programArguments({ quiet: options.quiet ?? DEFAULT_CAPTURE_QUIET });
  }
  if (task.id === "garden") {
    return options.gardenProgramArguments ?? task.programArguments();
  }
  return options.updateProgramArguments ?? task.programArguments();
}

function plistPathForTask(
  task: ScheduledTaskDefinition,
  home: string,
  options: Pick<AutomationOptions, "plistPath" | "gardenPlistPath" | "updatePlistPath">,
): string {
  if (task.id === "capture") return options.plistPath ?? defaultCapturePlistPath(home);
  if (task.id === "garden") return options.gardenPlistPath ?? defaultGardenPlistPath(home);
  return options.updatePlistPath ?? defaultUpdatePlistPath(home);
}

function resolveTaskWorkingDirectory(
  task: ScheduledTaskDefinition,
  cwd: string,
): string | undefined {
  if (task.workingDirectory === "none") return undefined;
  return findNearestAlmanacDir(cwd) ?? path.resolve(cwd);
}

async function writeAutomationPlists(plan: AutomationInstallPlan): Promise<void> {
  const jobs = plan.jobs.map((job) => job.job);
  await ensureLaunchdDirs(jobs);
  await Promise.all(jobs.map((job) => writeLaunchdPlist(job)));
}

async function activateAutomationJobs(
  plan: AutomationInstallPlan,
  exec: ExecFn | undefined,
): Promise<{ ok: true } | { ok: false; result: CommandResult }> {
  for (const planned of plan.jobs) {
    try {
      await bootstrapLaunchdJob(planned.job.plistPath, exec);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        result: {
          stdout: "",
          stderr:
            `almanac: ${TASK_LABELS[planned.task.id]} plist written to ${planned.job.plistPath}, but launchctl bootstrap failed: ${msg}\n`,
          exitCode: 1,
        },
      };
    }
  }
  if (plan.disabledGardenPlistPath !== null && existsSync(plan.disabledGardenPlistPath)) {
    await removeLaunchdJob(plan.disabledGardenPlistPath, exec);
  }
  return { ok: true };
}

function formatAutomationInstall(
  plan: AutomationInstallPlan,
  captureSince: string | null,
): string {
  const lines = ["almanac: automation installed"];
  for (const planned of plan.jobs) {
    lines.push(`  ${planned.task.id} interval: ${planned.intervalInput}`);
    if (planned.task.id === "capture") {
      lines.push(`  capture quiet: ${readArgument(planned.job.programArguments, "--quiet") ?? DEFAULT_CAPTURE_QUIET}`);
      if (captureSince !== null) {
        lines.push(`  capturing transcripts after: ${captureSince}`);
      }
    }
    lines.push(`  ${planned.task.id} command: ${planned.job.programArguments.join(" ")}`);
    lines.push(`  ${planned.task.id} plist: ${planned.job.plistPath}`);
  }
  if (plan.disabledGardenPlistPath !== null) {
    lines.push("  garden: disabled");
  }
  return `${lines.join("\n")}\n`;
}

function readArgument(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] ?? null;
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

function formatAutomationStatus(
  task: ScheduledTaskDefinition,
  status: LaunchdJobStatus,
): string {
  if (status.contents === null) return `${TASK_LABELS[task.id]}: not installed\n`;
  const extra = task.id === "capture"
    ? (() => {
      const quiet = readProgramArgumentAfter(status.contents!, "--quiet");
      return quiet !== null ? `  quiet: ${quiet}\n` : "";
    })()
    : "";
  return (
    `${TASK_LABELS[task.id]}: installed\n` +
    `  plist: ${status.plistPath}\n` +
    `  launchd loaded: ${status.loaded ? "yes" : "no"}\n` +
    (status.intervalSeconds !== null ? `  interval: ${status.intervalSeconds}s\n` : "") +
    extra
  );
}
