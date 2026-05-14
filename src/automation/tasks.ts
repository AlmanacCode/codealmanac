import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CAPTURE_SWEEP_LABEL = "com.codealmanac.capture-sweep";
export const GARDEN_LABEL = "com.codealmanac.garden";

export const DEFAULT_CAPTURE_INTERVAL = "5h";
export const DEFAULT_CAPTURE_QUIET = "45m";
export const DEFAULT_GARDEN_INTERVAL = "2d";

export type ScheduledTaskId = "capture-sweep" | "garden";
export type ScheduledTaskWorkingDirectory = "none" | "nearest-almanac-repo";

export interface ScheduledTaskDefinition {
  id: ScheduledTaskId;
  label: string;
  defaultInterval: string;
  plistPath: (home: string) => string;
  stdoutLogName: string;
  stderrLogName: string;
  workingDirectory: ScheduledTaskWorkingDirectory;
  programArguments: (options?: { quiet?: string }) => string[];
}

export const CAPTURE_SWEEP_TASK: ScheduledTaskDefinition = {
  id: "capture-sweep",
  label: CAPTURE_SWEEP_LABEL,
  defaultInterval: DEFAULT_CAPTURE_INTERVAL,
  plistPath: (home) =>
    path.join(home, "Library", "LaunchAgents", `${CAPTURE_SWEEP_LABEL}.plist`),
  stdoutLogName: "capture-sweep.out.log",
  stderrLogName: "capture-sweep.err.log",
  workingDirectory: "none",
  programArguments: (options) => [
    ...defaultCliProgramArguments(),
    "capture",
    "sweep",
    "--quiet",
    options?.quiet ?? DEFAULT_CAPTURE_QUIET,
  ],
};

export const GARDEN_TASK: ScheduledTaskDefinition = {
  id: "garden",
  label: GARDEN_LABEL,
  defaultInterval: DEFAULT_GARDEN_INTERVAL,
  plistPath: (home) =>
    path.join(home, "Library", "LaunchAgents", `${GARDEN_LABEL}.plist`),
  stdoutLogName: "garden.out.log",
  stderrLogName: "garden.err.log",
  workingDirectory: "nearest-almanac-repo",
  programArguments: () => [...defaultCliProgramArguments(), "garden"],
};

export const SCHEDULED_TASKS = {
  captureSweep: CAPTURE_SWEEP_TASK,
  garden: GARDEN_TASK,
} as const;

export function scheduledTaskLogPaths(
  task: ScheduledTaskDefinition,
  home: string,
): { stdoutPath: string; stderrPath: string } {
  const logsDir = path.join(home, ".almanac", "logs");
  return {
    stdoutPath: path.join(logsDir, task.stdoutLogName),
    stderrPath: path.join(logsDir, task.stderrLogName),
  };
}

export function captureSweepProgramArguments(
  quiet: string = DEFAULT_CAPTURE_QUIET,
): string[] {
  return CAPTURE_SWEEP_TASK.programArguments({ quiet });
}

export function gardenProgramArguments(): string[] {
  return GARDEN_TASK.programArguments();
}

export function defaultCliProgramArguments(): string[] {
  const cliEntry = findPackageCliEntry() ??
    (process.argv[1] !== undefined
      ? path.resolve(process.argv[1])
      : path.resolve(process.cwd(), "dist", "codealmanac.js"));
  return [process.execPath, cliEntry];
}

export function defaultCapturePlistPath(home: string = homedir()): string {
  return CAPTURE_SWEEP_TASK.plistPath(home);
}

export function defaultGardenPlistPath(home: string = homedir()): string {
  return GARDEN_TASK.plistPath(home);
}

function findPackageCliEntry(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, "package.json");
    const cli = path.join(dir, "dist", "codealmanac.js");
    if (existsSync(pkg) && existsSync(cli)) return cli;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
