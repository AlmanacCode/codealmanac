import { homedir } from "node:os";
import path from "node:path";

export const SYNC_LABEL = "com.codealmanac.sync";
export const LEGACY_CAPTURE_SWEEP_LABEL = "com.codealmanac.capture-sweep";
export const GARDEN_LABEL = "com.codealmanac.garden";
export const UPDATE_LABEL = "com.codealmanac.update";

export const DEFAULT_SYNC_INTERVAL = "5h";
export const DEFAULT_SYNC_QUIET = "45m";
export const DEFAULT_GARDEN_INTERVAL = "4h";
export const DEFAULT_UPDATE_INTERVAL = "1d";

export type ScheduledTaskId = "sync" | "garden" | "update";
export type ScheduledTaskWorkingDirectory = "none" | "nearest-almanac-repo";

export interface ScheduledTaskDefinition {
  id: ScheduledTaskId;
  label: string;
  defaultInterval: string;
  plistPath: (home: string) => string;
  stdoutLogName: string;
  stderrLogName: string;
  workingDirectory: ScheduledTaskWorkingDirectory;
}

export const SYNC_TASK: ScheduledTaskDefinition = {
  id: "sync",
  label: SYNC_LABEL,
  defaultInterval: DEFAULT_SYNC_INTERVAL,
  plistPath: (home) =>
    path.join(home, "Library", "LaunchAgents", `${SYNC_LABEL}.plist`),
  stdoutLogName: "sync.out.log",
  stderrLogName: "sync.err.log",
  workingDirectory: "none",
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
};

export const UPDATE_TASK: ScheduledTaskDefinition = {
  id: "update",
  label: UPDATE_LABEL,
  defaultInterval: DEFAULT_UPDATE_INTERVAL,
  plistPath: (home) =>
    path.join(home, "Library", "LaunchAgents", `${UPDATE_LABEL}.plist`),
  stdoutLogName: "update.out.log",
  stderrLogName: "update.err.log",
  workingDirectory: "none",
};

export const SCHEDULED_TASKS = {
  sync: SYNC_TASK,
  garden: GARDEN_TASK,
  update: UPDATE_TASK,
} as const;

export const DEFAULT_AUTOMATION_TASK_IDS: ScheduledTaskId[] = ["sync", "garden"];

export function scheduledTaskDefinition(
  id: ScheduledTaskId,
): ScheduledTaskDefinition {
  return SCHEDULED_TASKS[id];
}

export function isScheduledTaskId(value: string): value is ScheduledTaskId {
  return value === "sync" || value === "garden" || value === "update";
}

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

export function syncProgramArguments(
  cliProgramArguments: string[],
  quiet: string = DEFAULT_SYNC_QUIET,
): string[] {
  return [...cliProgramArguments, "sync", "--quiet", quiet];
}

export function gardenProgramArguments(cliProgramArguments: string[]): string[] {
  return [...cliProgramArguments, "garden"];
}

export function updateProgramArguments(cliProgramArguments: string[]): string[] {
  return [...cliProgramArguments, "update"];
}

export function defaultCapturePlistPath(home: string = homedir()): string {
  return path.join(home, "Library", "LaunchAgents", `${LEGACY_CAPTURE_SWEEP_LABEL}.plist`);
}

export function defaultSyncPlistPath(home: string = homedir()): string {
  return SYNC_TASK.plistPath(home);
}

export function defaultGardenPlistPath(home: string = homedir()): string {
  return GARDEN_TASK.plistPath(home);
}

export function defaultUpdatePlistPath(home: string = homedir()): string {
  return UPDATE_TASK.plistPath(home);
}
