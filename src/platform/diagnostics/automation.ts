import { existsSync } from "node:fs";
import { homedir } from "node:os";

import { detectLegacyCaptureSweepAutomation } from "../automation/legacy-capture.js";
import {
  defaultCapturePlistPath,
  defaultSyncPlistPath,
} from "../automation/paths.js";
import type { DiagnosticsAutomationStatus } from "./types.js";

export interface AutomationDiagnosticsProbeOptions {
  homeDir?: string;
  automationPlistPath?: string;
  legacyAutomationPlistPath?: string;
}

export async function probeDiagnosticAutomation(
  options: AutomationDiagnosticsProbeOptions = {},
): Promise<DiagnosticsAutomationStatus> {
  const home = options.homeDir ?? homedir();
  const legacy = await detectLegacyCaptureSweepAutomation({
    homeDir: home,
    plistPath: options.legacyAutomationPlistPath ?? defaultCapturePlistPath(home),
  });
  if (legacy !== null) {
    return { status: "legacy", plistPath: legacy.plistPath };
  }

  const plistPath = options.automationPlistPath ?? defaultSyncPlistPath(home);
  return existsSync(plistPath)
    ? { status: "installed", plistPath }
    : { status: "missing" };
}
