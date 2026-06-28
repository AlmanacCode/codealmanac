import {
  installAutomation,
  readAutomationStatus,
  uninstallAutomation,
  type AutomationTaskId,
  type AutomationInstallOptions,
  type AutomationScheduler,
  type AutomationStatusOptions,
  type AutomationUninstallOptions,
} from "../../services/automation/index.js";
import {
  renderAutomationInstallResult,
  renderAutomationStatusResult,
  renderAutomationUninstallResult,
  type AutomationCommandResult,
} from "./automation-render.js";

export type { AutomationCommandResult } from "./automation-render.js";

export interface AutomationInstallCommandOptions {
  tasks?: AutomationTaskId[];
  every?: string;
  quiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  cwd: string;
  homeDir: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  programArguments?: string[];
  gardenProgramArguments?: string[];
  updateProgramArguments?: string[];
  scheduler: AutomationScheduler;
  now?: Date;
  configPath?: string;
}

export interface AutomationUninstallCommandOptions {
  tasks?: AutomationTaskId[];
  homeDir: string;
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  scheduler: AutomationScheduler;
}

export interface AutomationStatusCommandOptions {
  tasks?: AutomationTaskId[];
  homeDir: string;
  plistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  legacyCapturePlistPath?: string;
  scheduler: AutomationScheduler;
}

export async function runAutomationInstall(
  options: AutomationInstallCommandOptions,
): Promise<AutomationCommandResult> {
  return renderAutomationInstallResult(
    await installAutomation(toAutomationInstallOptions(options)),
  );
}

export async function runAutomationUninstall(
  options: AutomationUninstallCommandOptions,
): Promise<AutomationCommandResult> {
  return renderAutomationUninstallResult(
    await uninstallAutomation(toAutomationUninstallOptions(options)),
  );
}

export async function runAutomationStatus(
  options: AutomationStatusCommandOptions,
): Promise<AutomationCommandResult> {
  return renderAutomationStatusResult(
    await readAutomationStatus(toAutomationStatusOptions(options)),
  );
}

function toAutomationInstallOptions(
  options: AutomationInstallCommandOptions,
): AutomationInstallOptions {
  return {
    tasks: options.tasks,
    every: options.every,
    quiet: options.quiet,
    gardenEvery: options.gardenEvery,
    gardenOff: options.gardenOff,
    cwd: options.cwd,
    pathEnvironment: options.pathEnvironment,
    cliProgramArguments: options.cliProgramArguments,
    homeDir: options.homeDir,
    plistPath: options.plistPath,
    gardenPlistPath: options.gardenPlistPath,
    updatePlistPath: options.updatePlistPath,
    programArguments: options.programArguments,
    gardenProgramArguments: options.gardenProgramArguments,
    updateProgramArguments: options.updateProgramArguments,
    scheduler: options.scheduler,
    now: options.now,
    configPath: options.configPath,
  };
}

function toAutomationUninstallOptions(
  options: AutomationUninstallCommandOptions,
): AutomationUninstallOptions {
  return {
    tasks: options.tasks,
    homeDir: options.homeDir,
    plistPath: options.plistPath,
    gardenPlistPath: options.gardenPlistPath,
    updatePlistPath: options.updatePlistPath,
    scheduler: options.scheduler,
  };
}

function toAutomationStatusOptions(
  options: AutomationStatusCommandOptions,
): AutomationStatusOptions {
  return {
    tasks: options.tasks,
    homeDir: options.homeDir,
    plistPath: options.plistPath,
    gardenPlistPath: options.gardenPlistPath,
    updatePlistPath: options.updatePlistPath,
    legacyCapturePlistPath: options.legacyCapturePlistPath,
    scheduler: options.scheduler,
  };
}
