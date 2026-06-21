import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { ExecFn } from "../../automation/launchd.js";
import type { ScheduledTaskId } from "../../automation/tasks.js";
import type { CommandResult } from "../../cli/helpers.js";

/**
 * Windows scheduler adapter.
 *
 * macOS schedules automation through launchd plists; Windows uses Task
 * Scheduler via `schtasks`. We mirror the plist model by recording a small
 * JSON manifest per task under `~/.almanac/automation/` so `status` and
 * `doctor` can report what was installed without re-querying the scheduler.
 */

const WINDOWS_TASK_NAMES: Record<ScheduledTaskId, string> = {
  capture: "\\CodeAlmanac\\CaptureSweep",
  garden: "\\CodeAlmanac\\Garden",
  update: "\\CodeAlmanac\\Update",
};

const TASK_LABELS: Record<ScheduledTaskId, string> = {
  capture: "auto-capture automation",
  garden: "garden automation",
  update: "auto-update automation",
};

export interface WindowsAutomationJob {
  taskId: ScheduledTaskId;
  intervalInput: string;
  intervalSeconds: number;
  programArguments: string[];
  workingDirectory?: string;
}

export interface WindowsAutomationManifest {
  scheduler: "windows-task-scheduler";
  taskName: string;
  command: string[];
  intervalSeconds: number;
  workingDirectory?: string;
}

export function windowsManifestPath(
  taskId: ScheduledTaskId,
  home: string = homedir(),
): string {
  return path.join(home, ".almanac", "automation", `windows-${taskId}.json`);
}

export function defaultWindowsCaptureManifestPath(home: string = homedir()): string {
  return windowsManifestPath("capture", home);
}

export function windowsTaskName(taskId: ScheduledTaskId): string {
  return WINDOWS_TASK_NAMES[taskId];
}

export async function installWindowsAutomation(args: {
  home: string;
  jobs: WindowsAutomationJob[];
  disabledTaskIds: ScheduledTaskId[];
  captureSince: string | null;
  exec: ExecFn;
}): Promise<CommandResult> {
  // Validate every interval before creating any task so a bad value does not
  // leave a half-installed schedule.
  for (const job of args.jobs) {
    const schedule = windowsSchedule(job.intervalSeconds);
    if (!schedule.ok) {
      return { stdout: "", stderr: `almanac: ${schedule.error}\n`, exitCode: 1 };
    }
  }

  await mkdir(path.join(args.home, ".almanac", "automation"), { recursive: true });

  for (const job of args.jobs) {
    const taskName = WINDOWS_TASK_NAMES[job.taskId];
    const schedule = windowsSchedule(job.intervalSeconds);
    if (!schedule.ok) continue; // already validated above
    try {
      await args.exec("schtasks", [
        "/Create",
        "/TN",
        taskName,
        ...schedule.args,
        "/TR",
        windowsTaskCommand(job.programArguments, {
          workingDirectory: job.workingDirectory,
        }),
        "/F",
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `almanac: ${TASK_LABELS[job.taskId]} schtasks create failed: ${msg}\n`,
        exitCode: 1,
      };
    }
    await writeWindowsManifest(windowsManifestPath(job.taskId, args.home), {
      scheduler: "windows-task-scheduler",
      taskName,
      command: job.programArguments,
      intervalSeconds: job.intervalSeconds,
      workingDirectory: job.workingDirectory,
    });
  }

  for (const taskId of args.disabledTaskIds) {
    await deleteWindowsTask(taskId, args.home, args.exec);
  }

  return {
    stdout: formatWindowsInstall(args.jobs, args.disabledTaskIds, args.captureSince, args.home),
    stderr: "",
    exitCode: 0,
  };
}

export async function uninstallWindowsAutomation(args: {
  home: string;
  taskIds: ScheduledTaskId[];
  exec: ExecFn;
}): Promise<CommandResult> {
  const removed: string[] = [];
  for (const taskId of args.taskIds) {
    const manifestPath = windowsManifestPath(taskId, args.home);
    if (!existsSync(manifestPath)) continue;
    await deleteWindowsTask(taskId, args.home, args.exec);
    removed.push(manifestPath);
  }
  if (removed.length === 0) {
    return { stdout: "almanac: automation not installed\n", stderr: "", exitCode: 0 };
  }
  return {
    stdout:
      `almanac: automation removed\n` +
      removed.map((pathValue) => `  manifest: ${pathValue}\n`).join(""),
    stderr: "",
    exitCode: 0,
  };
}

export async function statusWindowsAutomation(args: {
  home: string;
  taskIds: ScheduledTaskId[];
}): Promise<CommandResult> {
  const sections: string[] = [];
  for (const taskId of args.taskIds) {
    const manifest = await readWindowsManifest(windowsManifestPath(taskId, args.home));
    sections.push(formatWindowsStatus(TASK_LABELS[taskId], manifest));
  }
  return { stdout: sections.join(""), stderr: "", exitCode: 0 };
}

async function deleteWindowsTask(
  taskId: ScheduledTaskId,
  home: string,
  exec: ExecFn,
): Promise<void> {
  try {
    await exec("schtasks", ["/Delete", "/TN", WINDOWS_TASK_NAMES[taskId], "/F"]);
  } catch {
    // Already absent is still a successful disable/uninstall.
  }
  await rm(windowsManifestPath(taskId, home), { force: true });
}

function formatWindowsInstall(
  jobs: WindowsAutomationJob[],
  disabledTaskIds: ScheduledTaskId[],
  captureSince: string | null,
  home: string,
): string {
  const lines = ["almanac: automation installed", "  scheduler: Windows Task Scheduler"];
  for (const job of jobs) {
    lines.push(`  ${job.taskId} interval: ${job.intervalInput}`);
    if (job.taskId === "capture") {
      const quiet = readArgument(job.programArguments, "--quiet");
      if (quiet !== null) lines.push(`  capture quiet: ${quiet}`);
      if (captureSince !== null) {
        lines.push(`  capturing transcripts after: ${captureSince}`);
      }
    }
    lines.push(`  ${job.taskId} command: ${job.programArguments.join(" ")}`);
    lines.push(`  ${job.taskId} task: ${WINDOWS_TASK_NAMES[job.taskId]}`);
    lines.push(`  ${job.taskId} manifest: ${windowsManifestPath(job.taskId, home)}`);
  }
  for (const taskId of disabledTaskIds) {
    lines.push(`  ${taskId}: disabled`);
  }
  return `${lines.join("\n")}\n`;
}

function formatWindowsStatus(
  label: string,
  manifest: WindowsAutomationManifest | null,
): string {
  if (manifest === null) return `${label}: not installed\n`;
  const quiet = readArgument(manifest.command, "--quiet");
  return (
    `${label}: installed\n` +
    `  scheduler: Windows Task Scheduler\n` +
    `  task: ${manifest.taskName}\n` +
    `  interval: ${manifest.intervalSeconds}s\n` +
    (quiet !== null ? `  quiet: ${quiet}\n` : "")
  );
}

function readArgument(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] ?? null;
}

async function writeWindowsManifest(
  manifestPath: string,
  manifest: WindowsAutomationManifest,
): Promise<void> {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function readWindowsManifest(
  manifestPath: string,
): Promise<WindowsAutomationManifest | null> {
  if (!existsSync(manifestPath)) return null;
  try {
    const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as Partial<WindowsAutomationManifest>;
    if (
      parsed.scheduler === "windows-task-scheduler" &&
      typeof parsed.taskName === "string" &&
      Array.isArray(parsed.command) &&
      parsed.command.every((arg) => typeof arg === "string") &&
      typeof parsed.intervalSeconds === "number"
    ) {
      return {
        scheduler: "windows-task-scheduler",
        taskName: parsed.taskName,
        command: parsed.command,
        intervalSeconds: parsed.intervalSeconds,
        workingDirectory:
          typeof parsed.workingDirectory === "string" ? parsed.workingDirectory : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Translate an interval in seconds to schtasks `/SC` arguments. Task
 * Scheduler accepts whole-minute intervals from 1 to 1439, or whole-day
 * intervals — anything else is rejected with a clear error.
 */
export function windowsSchedule(
  seconds: number,
): { ok: true; args: string[] } | { ok: false; error: string } {
  if (seconds % 60 === 0 && seconds / 60 >= 1 && seconds / 60 <= 1439) {
    return { ok: true, args: ["/SC", "MINUTE", "/MO", String(seconds / 60)] };
  }
  const daySeconds = 24 * 60 * 60;
  if (seconds % daySeconds === 0 && seconds / daySeconds >= 1 && seconds / daySeconds <= 365) {
    return { ok: true, args: ["/SC", "DAILY", "/MO", String(seconds / daySeconds)] };
  }
  return {
    ok: false,
    error:
      "Windows Task Scheduler automation interval must be whole minutes up to 1439 minutes, or whole days",
  };
}

function windowsTaskCommand(
  args: string[],
  options: { workingDirectory?: string } = {},
): string {
  const command = args.map(quoteWindowsTaskArg).join(" ");
  if (options.workingDirectory === undefined) return command;
  const cdCommand = `cd /d ${quoteWindowsTaskArg(options.workingDirectory)}`;
  return `cmd.exe /d /s /c "${cdCommand} && ${command}"`;
}

function quoteWindowsTaskArg(arg: string): string {
  if (arg.length === 0) return '""';
  if (!/[\s"\\:]/u.test(arg)) return arg;
  return `"${arg.replaceAll('"', '\\"')}"`;
}
