import { homedir } from "node:os";

import type { CommandResult } from "../helpers.js";
import {
  installAutomation,
  readAutomationStatus,
  uninstallAutomation,
  type AutomationInstallOptions,
  type InstalledAutomationTask,
  type AutomationStatusOptions,
  type AutomationStatusSection,
  type AutomationUninstallOptions,
} from "../../services/automation/index.js";
import {
  defaultSyncPlistPath,
  isScheduledTaskId,
  type ScheduledTaskId,
} from "../../platform/automation/tasks.js";

export { cleanupLegacyHooks } from "../../platform/automation/legacy-hooks.js";

export type AutomationOptions = AutomationInstallOptions & AutomationUninstallOptions;
export type { AutomationStatusOptions };

const TASK_LABELS: Record<ScheduledTaskId, string> = {
  sync: "sync automation",
  garden: "garden automation",
  update: "auto-update automation",
};

export async function runAutomationInstall(
  options: AutomationInstallOptions = {},
): Promise<CommandResult> {
  const result = await installAutomation(options);
  if (result.status === "invalid") {
    return { stdout: "", stderr: `almanac: ${result.error}\n`, exitCode: 1 };
  }
  if (result.status === "activation-failed") {
    return {
      stdout: "",
      stderr:
        `almanac: ${TASK_LABELS[result.taskId]} plist written to ${result.plistPath}, but launchctl bootstrap failed: ${result.message}\n`,
      exitCode: 1,
    };
  }
  return {
    stdout: formatAutomationInstall({
      tasks: result.tasks,
      gardenDisabled: result.gardenDisabled,
      syncSince: result.syncSince,
    }),
    stderr: "",
    exitCode: 0,
  };
}

export async function runAutomationUninstall(
  options: AutomationUninstallOptions = {},
): Promise<CommandResult> {
  const result = await uninstallAutomation(options);
  if (result.status === "not-installed") {
    return {
      stdout: "almanac: automation not installed\n",
      stderr: "",
      exitCode: 0,
    };
  }
  return {
    stdout:
      `almanac: automation removed\n` +
      result.plistPaths.map((pathValue) => `  plist: ${pathValue}\n`).join(""),
    stderr: "",
    exitCode: 0,
  };
}

export async function runAutomationStatus(
  options: AutomationStatusOptions = {},
): Promise<CommandResult> {
  const result = await readAutomationStatus(options);
  return {
    stdout: result.sections.map(formatAutomationStatusSection).join(""),
    stderr: "",
    exitCode: 0,
  };
}

export function defaultPlistPath(home: string = homedir()): string {
  return defaultSyncPlistPath(home);
}

export function parseAutomationTaskIds(
  values: string[],
): { ok: true; tasks: ScheduledTaskId[] } | { ok: false; error: string } {
  const tasks: ScheduledTaskId[] = [];
  for (const value of values) {
    if (!isScheduledTaskId(value)) {
      return {
        ok: false,
        error: `unknown automation task '${value}' (expected sync, garden, or update)`,
      };
    }
    if (!tasks.includes(value)) tasks.push(value);
  }
  return { ok: true, tasks };
}

function formatAutomationInstall(result: {
  tasks: InstalledAutomationTask[];
  gardenDisabled: boolean;
  syncSince: string | null;
}): string {
  const lines = ["almanac: automation installed"];
  for (const task of result.tasks) {
    lines.push(`  ${task.taskId} interval: ${task.intervalInput}`);
    if (task.taskId === "sync") {
      if (task.quiet !== null) lines.push(`  sync quiet: ${task.quiet}`);
      if (result.syncSince !== null) {
        lines.push(`  syncing transcripts after: ${result.syncSince}`);
      }
    }
    lines.push(`  ${task.taskId} command: ${task.command.join(" ")}`);
    lines.push(`  ${task.taskId} plist: ${task.plistPath}`);
  }
  if (result.gardenDisabled) {
    lines.push("  garden: disabled");
  }
  return `${lines.join("\n")}\n`;
}

function formatAutomationStatusSection(section: AutomationStatusSection): string {
  if (section.status === "legacy-capture") {
    return formatLegacyCaptureSweepStatus(section.plistPath);
  }
  if (!section.installed) {
    return `${TASK_LABELS[section.taskId]}: not installed\n`;
  }
  const extra = section.quiet !== null ? `  quiet: ${section.quiet}\n` : "";
  return (
    `${TASK_LABELS[section.taskId]}: installed\n` +
    `  plist: ${section.plistPath}\n` +
    `  launchd loaded: ${section.loaded ? "yes" : "no"}\n` +
    (section.intervalSeconds !== null ? `  interval: ${section.intervalSeconds}s\n` : "") +
    extra
  );
}

function formatLegacyCaptureSweepStatus(plistPath: string): string {
  return (
    "legacy automation: uses removed command capture sweep\n" +
    `  plist: ${plistPath}\n` +
    "  run: almanac migrate automation\n"
  );
}
