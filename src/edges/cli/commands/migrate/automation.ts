import {
  migrateLegacyAutomation,
  type AutomationScheduler,
} from "../../../../services/automation/index.js";
import {
  renderMigrateAutomation,
  type MigrateCommandOutput,
} from "./render.js";

export interface MigrateAutomationOptions {
  cwd: string;
  homeDir: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  json?: boolean;
  legacyPlistPath?: string;
  syncPlistPath?: string;
  scheduler: AutomationScheduler;
}

export async function runMigrateAutomation(
  options: MigrateAutomationOptions,
): Promise<MigrateCommandOutput> {
  return renderMigrateAutomation(await migrateLegacyAutomation(options), {
    json: options.json,
  });
}
