import type { AutomationScheduler } from "../services/automation/scheduler.js";
import { createLaunchdAutomationScheduler } from "../platform/automation/scheduler.js";

export type AutomationRuntimeExec = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

export function createAutomationScheduler(options: {
  exec?: AutomationRuntimeExec;
} = {}): AutomationScheduler {
  return createLaunchdAutomationScheduler({
    exec: options.exec,
  });
}
