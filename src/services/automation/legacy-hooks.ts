import type { AutomationScheduler } from "../../shared/automation-scheduler.js";

export interface CleanupLegacyAutomationHooksOptions {
  homeDir: string;
  scheduler: AutomationScheduler;
}

export async function cleanupLegacyAutomationHooks(
  options: CleanupLegacyAutomationHooksOptions,
): Promise<void> {
  await options.scheduler.cleanupLegacyHooks({ homeDir: options.homeDir });
}
