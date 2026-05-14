import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { CommandResult } from "../../cli/helpers.js";

type ExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

const WINDOWS_CAPTURE_TASK = "\\CodeAlmanac\\CaptureSweep";
const WINDOWS_GARDEN_TASK = "\\CodeAlmanac\\Garden";

interface WindowsAutomationManifest {
  scheduler: "windows-task-scheduler";
  taskName: string;
  command: string[];
  intervalSeconds: number;
  quiet?: string;
}

export function defaultWindowsCaptureManifestPath(home: string = homedir()): string {
  return path.join(home, ".almanac", "automation", "windows-capture-sweep.json");
}

export function defaultWindowsGardenManifestPath(home: string = homedir()): string {
  return path.join(home, ".almanac", "automation", "windows-garden.json");
}

export async function installWindowsAutomation(args: {
  home: string;
  intervalSeconds: number;
  intervalLabel: string;
  quietValue: string;
  gardenIntervalSeconds: number | null;
  gardenIntervalLabel: string;
  programArguments: string[];
  gardenProgramArguments: string[];
  exec: ExecFn;
  captureSince: string;
}): Promise<CommandResult> {
  const captureSchedule = windowsSchedule(args.intervalSeconds);
  if (!captureSchedule.ok) {
    return { stdout: "", stderr: `almanac: ${captureSchedule.error}\n`, exitCode: 1 };
  }
  const gardenSchedule = args.gardenIntervalSeconds === null
    ? null
    : windowsSchedule(args.gardenIntervalSeconds);
  if (gardenSchedule !== null && !gardenSchedule.ok) {
    return { stdout: "", stderr: `almanac: ${gardenSchedule.error}\n`, exitCode: 1 };
  }

  const captureManifest = defaultWindowsCaptureManifestPath(args.home);
  const gardenManifest = defaultWindowsGardenManifestPath(args.home);
  await mkdir(path.dirname(captureManifest), { recursive: true });

  try {
    await args.exec("schtasks", [
      "/Create",
      "/TN",
      WINDOWS_CAPTURE_TASK,
      ...captureSchedule.args,
      "/TR",
      windowsTaskCommand(args.programArguments),
      "/F",
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: "",
      stderr: `almanac: Windows task manifest prepared at ${captureManifest}, but schtasks create failed: ${msg}\n`,
      exitCode: 1,
    };
  }
  await writeWindowsManifest(captureManifest, {
    scheduler: "windows-task-scheduler",
    taskName: WINDOWS_CAPTURE_TASK,
    command: args.programArguments,
    intervalSeconds: args.intervalSeconds,
    quiet: args.quietValue,
  });

  if (args.gardenIntervalSeconds !== null && gardenSchedule !== null) {
    try {
      await args.exec("schtasks", [
        "/Create",
        "/TN",
        WINDOWS_GARDEN_TASK,
        ...gardenSchedule.args,
        "/TR",
        windowsTaskCommand(args.gardenProgramArguments),
        "/F",
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        stdout: "",
        stderr: `almanac: Windows capture task installed, but garden task create failed: ${msg}\n`,
        exitCode: 1,
      };
    }
    await writeWindowsManifest(gardenManifest, {
      scheduler: "windows-task-scheduler",
      taskName: WINDOWS_GARDEN_TASK,
      command: args.gardenProgramArguments,
      intervalSeconds: args.gardenIntervalSeconds,
    });
  } else if (existsSync(gardenManifest)) {
    try {
      await args.exec("schtasks", ["/Delete", "/TN", WINDOWS_GARDEN_TASK, "/F"]);
    } catch {
      // Already absent is still a successful disable.
    }
    await rm(gardenManifest, { force: true });
  }

  return {
    stdout:
      `almanac: automation installed\n` +
      `  scheduler: Windows Task Scheduler\n` +
      `  capture interval: ${args.intervalLabel}\n` +
      `  capture quiet: ${args.quietValue}\n` +
      `  capturing transcripts after: ${args.captureSince}\n` +
      `  capture command: ${args.programArguments.join(" ")}\n` +
      `  capture task: ${WINDOWS_CAPTURE_TASK}\n` +
      `  capture manifest: ${captureManifest}\n` +
      (args.gardenIntervalSeconds !== null
        ? `  garden interval: ${args.gardenIntervalLabel}\n` +
          `  garden command: ${args.gardenProgramArguments.join(" ")}\n` +
          `  garden task: ${WINDOWS_GARDEN_TASK}\n` +
          `  garden manifest: ${gardenManifest}\n`
        : `  garden: disabled\n`),
    stderr: "",
    exitCode: 0,
  };
}

export async function uninstallWindowsAutomation(args: {
  home: string;
  exec: ExecFn;
}): Promise<CommandResult> {
  const manifests = [
    { path: defaultWindowsCaptureManifestPath(args.home), taskName: WINDOWS_CAPTURE_TASK },
    { path: defaultWindowsGardenManifestPath(args.home), taskName: WINDOWS_GARDEN_TASK },
  ];
  const removed: string[] = [];
  for (const manifest of manifests) {
    if (!existsSync(manifest.path)) continue;
    try {
      await args.exec("schtasks", ["/Delete", "/TN", manifest.taskName, "/F"]);
    } catch {
      // Already absent is still a successful uninstall.
    }
    await rm(manifest.path, { force: true });
    removed.push(manifest.path);
  }
  if (removed.length === 0) {
    return {
      stdout: "almanac: automation not installed\n",
      stderr: "",
      exitCode: 0,
    };
  }
  return {
    stdout:
      `almanac: automation removed\n` +
      removed.map((pathValue) => `  manifest: ${pathValue}\n`).join(""),
    stderr: "",
    exitCode: 0,
  };
}

export async function statusWindowsAutomation(home: string): Promise<CommandResult> {
  const capture = await readWindowsManifest(defaultWindowsCaptureManifestPath(home));
  const garden = await readWindowsManifest(defaultWindowsGardenManifestPath(home));
  return {
    stdout:
      formatWindowsStatus("auto-capture automation", capture) +
      formatWindowsStatus("garden automation", garden),
    stderr: "",
    exitCode: 0,
  };
}

function formatWindowsStatus(
  label: string,
  manifest: WindowsAutomationManifest | null,
): string {
  if (manifest === null) return `${label}: not installed\n`;
  return (
    `${label}: installed\n` +
    `  scheduler: Windows Task Scheduler\n` +
    `  task: ${manifest.taskName}\n` +
    `  interval: ${manifest.intervalSeconds}s\n` +
    (manifest.quiet !== undefined ? `  quiet: ${manifest.quiet}\n` : "")
  );
}

async function writeWindowsManifest(
  manifestPath: string,
  manifest: WindowsAutomationManifest,
): Promise<void> {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function readWindowsManifest(
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
        quiet: typeof parsed.quiet === "string" ? parsed.quiet : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function windowsSchedule(
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
    error: "Windows Task Scheduler automation interval must be whole minutes up to 1439 minutes, or whole days",
  };
}

function windowsTaskCommand(args: string[]): string {
  return args.map(quoteWindowsTaskArg).join(" ");
}

function quoteWindowsTaskArg(arg: string): string {
  if (arg.length === 0) return '""';
  if (!/[\s"\\:]/u.test(arg)) return arg;
  return `"${arg.replaceAll('"', '\\"')}"`;
}
