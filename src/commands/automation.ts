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
  CAPTURE_SWEEP_LABEL,
  CAPTURE_SWEEP_TASK,
  defaultCapturePlistPath,
  DEFAULT_CAPTURE_INTERVAL,
  DEFAULT_CAPTURE_QUIET,
  DEFAULT_GARDEN_INTERVAL,
  defaultGardenPlistPath,
  GARDEN_LABEL,
  GARDEN_TASK,
  scheduledTaskLogPaths,
  type ScheduledTaskDefinition,
} from "../automation/tasks.js";
import type { CommandResult } from "../cli/helpers.js";
import { parseDuration } from "../indexer/duration.js";
import { findNearestAlmanacDir } from "../paths.js";
import { ensureAutomationCaptureSince } from "../config/index.js";

export { cleanupLegacyHooks } from "../automation/legacy-hooks.js";

export interface AutomationOptions {
  every?: string;
  quiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  cwd?: string;
  homeDir?: string;
  plistPath?: string;
  gardenPlistPath?: string;
  programArguments?: string[];
  gardenProgramArguments?: string[];
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
  now?: Date;
  configPath?: string;
}

export interface AutomationStatusOptions {
  homeDir?: string;
  plistPath?: string;
  gardenPlistPath?: string;
  exec?: ExecFn;
}

export async function runAutomationInstall(
  options: AutomationOptions = {},
): Promise<CommandResult> {
  const plan = buildAutomationInstallPlan(options);
  if (!plan.ok) {
    return { stdout: "", stderr: `almanac: ${plan.error}\n`, exitCode: 1 };
  }

  await writeAutomationPlists(plan.value);

  const captureSince = await ensureAutomationCaptureSince(
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
  const plist = options.plistPath ?? defaultPlistPath(home);
  const gardenPlist = options.gardenPlistPath ?? defaultGardenPlistPath(home);
  const exec = options.exec;
  const removed: string[] = [];
  if (await removeLaunchdJob(plist, exec)) {
    removed.push(plist);
  }
  if (await removeLaunchdJob(gardenPlist, exec)) {
    removed.push(gardenPlist);
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
  const plist = options.plistPath ?? defaultPlistPath(home);
  const gardenPlist = options.gardenPlistPath ?? defaultGardenPlistPath(home);
  const capture = await readLaunchdJobStatus({
    label: CAPTURE_SWEEP_LABEL,
    plistPath: plist,
    exec: options.exec,
  });
  const garden = await readLaunchdJobStatus({
    label: GARDEN_LABEL,
    plistPath: gardenPlist,
    exec: options.exec,
  });
  return {
    stdout:
      formatAutomationStatus("auto-capture automation", capture, (contents) => {
        const quiet = readProgramArgumentAfter(contents, "--quiet");
        return quiet !== null ? `  quiet: ${quiet}\n` : "";
      }) +
      formatAutomationStatus("garden automation", garden, () => ""),
    stderr: "",
    exitCode: 0,
  };
}

export function defaultPlistPath(home: string = homedir()): string {
  return defaultCapturePlistPath(home);
}

interface AutomationInstallPlan {
  captureIntervalInput: string;
  quietInput: string;
  gardenIntervalInput: string;
  captureJob: LaunchdJobDefinition;
  gardenJob: LaunchdJobDefinition | null;
  gardenPlistPath: string;
}

function buildAutomationInstallPlan(
  options: AutomationOptions,
): { ok: true; value: AutomationInstallPlan } | { ok: false; error: string } {
  const captureIntervalInput = options.every ?? DEFAULT_CAPTURE_INTERVAL;
  const interval = parseInterval(captureIntervalInput);
  if (!interval.ok) return interval;

  const quietInput = options.quiet ?? DEFAULT_CAPTURE_QUIET;
  const quiet = parseQuiet(quietInput);
  if (!quiet.ok) return quiet;

  const gardenIntervalInput = options.gardenEvery ?? DEFAULT_GARDEN_INTERVAL;
  const gardenInterval = options.gardenOff === true
    ? null
    : parseInterval(gardenIntervalInput);
  if (gardenInterval !== null && !gardenInterval.ok) return gardenInterval;

  const home = options.homeDir ?? homedir();
  const capturePlistPath = options.plistPath ?? defaultPlistPath(home);
  const gardenPlistPath = options.gardenPlistPath ?? defaultGardenPlistPath(home);
  const environmentVariables = {
    PATH: buildLaunchPath(home, options.env?.PATH ?? process.env.PATH),
  };
  const captureLogs = scheduledTaskLogPaths(CAPTURE_SWEEP_TASK, home);
  const captureJob: LaunchdJobDefinition = {
    plistPath: capturePlistPath,
    label: CAPTURE_SWEEP_TASK.label,
    programArguments: options.programArguments ??
      CAPTURE_SWEEP_TASK.programArguments({ quiet: quietInput }),
    intervalSeconds: interval.seconds,
    environmentVariables,
    stdoutPath: captureLogs.stdoutPath,
    stderrPath: captureLogs.stderrPath,
  };
  const cwd = options.cwd ?? process.cwd();
  const gardenLogs = scheduledTaskLogPaths(GARDEN_TASK, home);
  const gardenJob: LaunchdJobDefinition | null = gardenInterval === null
    ? null
    : {
      plistPath: gardenPlistPath,
      label: GARDEN_TASK.label,
      programArguments: options.gardenProgramArguments ??
        GARDEN_TASK.programArguments(),
      intervalSeconds: gardenInterval.seconds,
      environmentVariables,
      workingDirectory: resolveTaskWorkingDirectory(GARDEN_TASK, cwd),
      stdoutPath: gardenLogs.stdoutPath,
      stderrPath: gardenLogs.stderrPath,
    };

  return {
    ok: true,
    value: {
      captureIntervalInput,
      quietInput,
      gardenIntervalInput,
      captureJob,
      gardenJob,
      gardenPlistPath,
    },
  };
}

function resolveTaskWorkingDirectory(
  task: ScheduledTaskDefinition,
  cwd: string,
): string | undefined {
  if (task.workingDirectory === "none") return undefined;
  return findNearestAlmanacDir(cwd) ?? path.resolve(cwd);
}

async function writeAutomationPlists(plan: AutomationInstallPlan): Promise<void> {
  const jobs = plan.gardenJob === null
    ? [plan.captureJob]
    : [plan.captureJob, plan.gardenJob];
  await ensureLaunchdDirs(jobs);
  await Promise.all(jobs.map((job) => writeLaunchdPlist(job)));
}

async function activateAutomationJobs(
  plan: AutomationInstallPlan,
  exec: ExecFn | undefined,
): Promise<{ ok: true } | { ok: false; result: CommandResult }> {
  try {
    await bootstrapLaunchdJob(plan.captureJob.plistPath, exec);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      result: {
        stdout: "",
        stderr:
          `almanac: automation plist written to ${plan.captureJob.plistPath}, but launchctl bootstrap failed: ${msg}\n`,
        exitCode: 1,
      },
    };
  }
  if (plan.gardenJob !== null) {
    try {
      await bootstrapLaunchdJob(plan.gardenJob.plistPath, exec);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        result: {
          stdout: "",
          stderr:
            `almanac: garden automation plist written to ${plan.gardenJob.plistPath}, but launchctl bootstrap failed: ${msg}\n`,
          exitCode: 1,
        },
      };
    }
  } else if (existsSync(plan.gardenPlistPath)) {
    await removeLaunchdJob(plan.gardenPlistPath, exec);
  }
  return { ok: true };
}

function formatAutomationInstall(
  plan: AutomationInstallPlan,
  captureSince: string,
): string {
  return (
    `almanac: automation installed\n` +
    `  capture interval: ${plan.captureIntervalInput}\n` +
    `  capture quiet: ${plan.quietInput}\n` +
    `  capturing transcripts after: ${captureSince}\n` +
    `  capture command: ${plan.captureJob.programArguments.join(" ")}\n` +
    `  capture plist: ${plan.captureJob.plistPath}\n` +
    (plan.gardenJob !== null
      ? `  garden interval: ${plan.gardenIntervalInput}\n` +
        `  garden command: ${plan.gardenJob.programArguments.join(" ")}\n` +
        `  garden plist: ${plan.gardenJob.plistPath}\n`
      : `  garden: disabled\n`)
  );
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
  label: string,
  status: LaunchdJobStatus,
  extra: (contents: string) => string,
): string {
  if (status.contents === null) return `${label}: not installed\n`;
  return (
    `${label}: installed\n` +
    `  plist: ${status.plistPath}\n` +
    `  launchd loaded: ${status.loaded ? "yes" : "no"}\n` +
    (status.intervalSeconds !== null ? `  interval: ${status.intervalSeconds}s\n` : "") +
    extra(status.contents)
  );
}
