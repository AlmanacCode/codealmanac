import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  automationLogsDir,
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
import {
  captureSweepProgramArguments,
  CAPTURE_SWEEP_LABEL,
  defaultCapturePlistPath,
  DEFAULT_CAPTURE_INTERVAL,
  DEFAULT_CAPTURE_QUIET,
  DEFAULT_GARDEN_INTERVAL,
  defaultGardenPlistPath,
  GARDEN_LABEL,
  gardenProgramArguments as defaultGardenProgramArguments,
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
  const interval = parseInterval(options.every ?? DEFAULT_CAPTURE_INTERVAL);
  if (!interval.ok) {
    return { stdout: "", stderr: `almanac: ${interval.error}\n`, exitCode: 1 };
  }
  const quietValue = options.quiet ?? DEFAULT_CAPTURE_QUIET;
  const quiet = parseQuiet(quietValue);
  if (!quiet.ok) {
    return { stdout: "", stderr: `almanac: ${quiet.error}\n`, exitCode: 1 };
  }
  const gardenValue = options.gardenEvery ?? DEFAULT_GARDEN_INTERVAL;
  const gardenInterval = options.gardenOff === true
    ? null
    : parseInterval(gardenValue);
  if (gardenInterval !== null && !gardenInterval.ok) {
    return { stdout: "", stderr: `almanac: ${gardenInterval.error}\n`, exitCode: 1 };
  }

  const home = options.homeDir ?? homedir();
  const plist = options.plistPath ?? defaultPlistPath(home);
  const gardenPlist = options.gardenPlistPath ?? defaultGardenPlistPath(home);
  const logsDir = automationLogsDir(home);
  const programArguments = options.programArguments ?? captureSweepProgramArguments(quietValue);
  const gardenProgramArguments = options.gardenProgramArguments ?? defaultGardenProgramArguments();
  const gardenWorkingDirectory = findNearestAlmanacDir(options.cwd ?? process.cwd()) ??
    path.resolve(options.cwd ?? process.cwd());
  const environmentVariables = {
    PATH: buildLaunchPath(home, options.env?.PATH ?? process.env.PATH),
  };
  const captureJob = {
    plistPath: plist,
    label: CAPTURE_SWEEP_LABEL,
    programArguments,
    intervalSeconds: interval.seconds,
    environmentVariables,
    stdoutPath: path.join(logsDir, "capture-sweep.out.log"),
    stderrPath: path.join(logsDir, "capture-sweep.err.log"),
  };
  const gardenJob = gardenInterval === null
    ? null
    : {
      plistPath: gardenPlist,
      label: GARDEN_LABEL,
      programArguments: gardenProgramArguments,
      intervalSeconds: gardenInterval.seconds,
      environmentVariables,
      workingDirectory: gardenWorkingDirectory,
      stdoutPath: path.join(logsDir, "garden.out.log"),
      stderrPath: path.join(logsDir, "garden.err.log"),
    };

  await ensureLaunchdDirs(gardenJob === null ? [captureJob] : [captureJob, gardenJob]);
  await writeLaunchdPlist(captureJob);
  if (gardenJob !== null) {
    await writeLaunchdPlist(gardenJob);
  }

  const captureSince = await ensureAutomationCaptureSince(
    (options.now ?? new Date()).toISOString(),
    options.configPath,
  );
  const exec = options.exec;
  try {
    await bootstrapLaunchdJob(plist, exec);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: "",
      stderr: `almanac: automation plist written to ${plist}, but launchctl bootstrap failed: ${msg}\n`,
      exitCode: 1,
    };
  }
  if (gardenJob !== null) {
    try {
      await bootstrapLaunchdJob(gardenPlist, exec);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `almanac: garden automation plist written to ${gardenPlist}, but launchctl bootstrap failed: ${msg}\n`,
        exitCode: 1,
      };
    }
  } else if (existsSync(gardenPlist)) {
    await removeLaunchdJob(gardenPlist, exec);
  }

  return {
    stdout:
      `almanac: automation installed\n` +
      `  capture interval: ${options.every ?? DEFAULT_CAPTURE_INTERVAL}\n` +
      `  capture quiet: ${quietValue}\n` +
      `  capturing transcripts after: ${captureSince}\n` +
      `  capture command: ${programArguments.join(" ")}\n` +
      `  capture plist: ${plist}\n` +
      (gardenInterval !== null
        ? `  garden interval: ${gardenValue}\n` +
          `  garden command: ${gardenProgramArguments.join(" ")}\n` +
          `  garden plist: ${gardenPlist}\n`
        : `  garden: disabled\n`),
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
