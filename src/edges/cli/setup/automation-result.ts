import type {
  AutomationInstallResult,
} from "../../../services/automation/index.js";
import { automationTaskLabel } from "../../../services/automation/index.js";

export interface SetupAutomationFailure {
  stderr: string;
  exitCode: 1;
}

export function automationInstallFailure(
  result: AutomationInstallResult,
): SetupAutomationFailure | null {
  if (result.status === "installed") return null;
  if (result.status === "invalid") {
    return setupAutomationFailure(`almanac: ${result.error}\n`);
  }
  return setupAutomationFailure(
    `almanac: ${automationTaskLabel(result.taskId)} plist written to ${
      result.plistPath
    }, but launchctl bootstrap failed: ${result.message}\n`,
  );
}

function setupAutomationFailure(stderr: string): SetupAutomationFailure {
  return { stderr, exitCode: 1 };
}
