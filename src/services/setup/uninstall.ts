import {
  removeAgentInstructions,
  removeClaudeImportLine,
  removeManagedBlock,
} from "../../agent/install-targets.js";
import {
  cleanupLegacyAutomationHooks,
  uninstallAutomation,
  type AutomationScheduler,
  type AutomationUninstallResult,
} from "../automation/index.js";

export interface SetupUninstallOptions {
  removeAutomation: boolean;
  removeGuides: boolean;
  homeDir: string;
  claudeDir: string;
  codexDir: string;
  cursorDir: string;
  windsurfDir: string;
  opencodeDir: string;
  automationPlistPath?: string;
  gardenPlistPath?: string;
  automationScheduler: AutomationScheduler;
}

export interface SetupUninstallResult {
  automation:
    | { action: "kept" }
    | ({ action: "checked" } & AutomationUninstallResult);
  guides:
    | { action: "kept" }
    | {
      action: "checked";
      anyChanges: boolean;
      filesTouched: string[];
    };
}

export async function uninstallSetup(
  options: SetupUninstallOptions,
): Promise<SetupUninstallResult> {
  const automation = options.removeAutomation
    ? await removeSetupAutomation(options)
    : { action: "kept" as const };
  const guides = options.removeGuides
    ? await removeSetupGuides(options)
    : { action: "kept" as const };

  return { automation, guides };
}

export function removeSetupImportLine(contents: string): {
  changed: boolean;
  body: string;
} {
  return removeClaudeImportLine(contents);
}

export function removeSetupManagedBlock(
  contents: string,
  start: string,
  end: string,
): { changed: boolean; body: string } {
  return removeManagedBlock(contents, start, end);
}

async function removeSetupAutomation(
  options: SetupUninstallOptions,
): Promise<SetupUninstallResult["automation"]> {
  await cleanupLegacyAutomationHooks({
    homeDir: options.homeDir,
    scheduler: options.automationScheduler,
  });
  const result = await uninstallAutomation({
    homeDir: options.homeDir,
    plistPath: options.automationPlistPath,
    gardenPlistPath: options.gardenPlistPath,
    scheduler: options.automationScheduler,
  });
  return { action: "checked", ...result };
}

async function removeSetupGuides(
  options: SetupUninstallOptions,
): Promise<SetupUninstallResult["guides"]> {
  const summary = await removeAgentInstructions({
    claudeDir: options.claudeDir,
    codexDir: options.codexDir,
    cursorDir: options.cursorDir,
    windsurfDir: options.windsurfDir,
    opencodeDir: options.opencodeDir,
  });

  return {
    action: "checked",
    anyChanges: summary.anyChanges,
    filesTouched: summary.filesTouched,
  };
}
