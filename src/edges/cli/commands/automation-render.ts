import { automationTaskLabel } from "../../../services/automation/index.js";
import type {
  AutomationInstallResult,
  AutomationStatusResult,
  AutomationStatusSection,
  AutomationUninstallResult,
  InstalledAutomationTask,
} from "../../../services/automation/index.js";

export interface AutomationCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderAutomationInstallResult(
  result: AutomationInstallResult,
): AutomationCommandResult {
  if (result.status === "invalid") {
    return error(`almanac: ${result.error}\n`);
  }
  if (result.status === "activation-failed") {
    return error(
      `almanac: ${automationTaskLabel(result.taskId)} plist written to ${
        result.plistPath
      }, but launchctl bootstrap failed: ${result.message}\n`,
    );
  }
  return ok(
    formatAutomationInstall({
      tasks: result.tasks,
      gardenDisabled: result.gardenDisabled,
      syncSince: result.syncSince,
    }),
  );
}

export function renderAutomationUninstallResult(
  result: AutomationUninstallResult,
): AutomationCommandResult {
  if (result.status === "not-installed") {
    return ok("almanac: automation not installed\n");
  }
  return ok(
    `almanac: automation removed\n` +
      result.plistPaths.map((pathValue) => `  plist: ${pathValue}\n`).join(""),
  );
}

export function renderAutomationStatusResult(
  result: AutomationStatusResult,
): AutomationCommandResult {
  return ok(result.sections.map(formatAutomationStatusSection).join(""));
}

function ok(stdout: string): AutomationCommandResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function error(stderr: string): AutomationCommandResult {
  return { stdout: "", stderr, exitCode: 1 };
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
    return `${automationTaskLabel(section.taskId)}: not installed\n`;
  }
  const quiet = section.quiet !== null ? `  quiet: ${section.quiet}\n` : "";
  return (
    `${automationTaskLabel(section.taskId)}: installed\n` +
    `  plist: ${section.plistPath}\n` +
    `  launchd loaded: ${section.loaded ? "yes" : "no"}\n` +
    (section.intervalSeconds !== null
      ? `  interval: ${section.intervalSeconds}s\n`
      : "") +
    quiet
  );
}

function formatLegacyCaptureSweepStatus(plistPath: string): string {
  return (
    "legacy automation: uses removed command capture sweep\n" +
    `  plist: ${plistPath}\n` +
    "  run: almanac migrate automation\n"
  );
}
