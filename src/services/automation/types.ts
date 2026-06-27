import type { ExecFn } from "../../platform/automation/launchd.js";
import type {
  ScheduledTaskId,
} from "../../platform/automation/tasks.js";

export interface AutomationInstallOptions {
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

export interface AutomationUninstallOptions {
  tasks?: ScheduledTaskId[];
  homeDir?: string;
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  exec?: ExecFn;
}

export interface AutomationStatusOptions {
  tasks?: ScheduledTaskId[];
  homeDir?: string;
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  legacyCapturePlistPath?: string;
  exec?: ExecFn;
}

export interface InstalledAutomationTask {
  taskId: ScheduledTaskId;
  intervalInput: string;
  command: string[];
  plistPath: string;
  quiet: string | null;
}

export type AutomationInstallResult =
  | {
    status: "installed";
    tasks: InstalledAutomationTask[];
    gardenDisabled: boolean;
    syncSince: string | null;
  }
  | { status: "invalid"; error: string }
  | {
    status: "activation-failed";
    taskId: ScheduledTaskId;
    plistPath: string;
    message: string;
  };

export type AutomationUninstallResult =
  | { status: "removed"; plistPaths: string[] }
  | { status: "not-installed" };

export type AutomationStatusSection =
  | {
    status: "task";
    taskId: ScheduledTaskId;
    installed: boolean;
    plistPath: string;
    loaded: boolean;
    intervalSeconds: number | null;
    quiet: string | null;
  }
  | {
    status: "legacy-capture";
    plistPath: string;
  };

export interface AutomationStatusResult {
  status: "checked";
  sections: AutomationStatusSection[];
}
