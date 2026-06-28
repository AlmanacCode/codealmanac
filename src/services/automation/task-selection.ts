import { DEFAULT_AUTOMATION_TASK_IDS } from "./tasks.js";
import type {
  AutomationInstallOptions,
  AutomationTaskId,
} from "./types.js";

export interface AutomationInstallTaskSelection {
  taskIds: AutomationTaskId[];
  explicitTasks: boolean;
}

export function selectAutomationInstallTasks(
  options: AutomationInstallOptions,
): { ok: true; value: AutomationInstallTaskSelection } | { ok: false; error: string } {
  const requestedTasks = options.tasks ?? [];
  const explicitTasks = requestedTasks.length > 0;
  if (explicitTasks && options.gardenOff === true) {
    return {
      ok: false,
      error: "--garden-off can only be used with the default automation install",
    };
  }
  if (explicitTasks && requestedTasks.length > 1 && options.every !== undefined) {
    return {
      ok: false,
      error: "--every can only target one explicit automation task at a time",
    };
  }

  return {
    ok: true,
    value: {
      explicitTasks,
      taskIds: selectedTaskIds(options.tasks, true)
        .filter((id) => !(id === "garden" && options.gardenOff === true)),
    },
  };
}

export function selectedTaskIds(
  tasks: AutomationTaskId[] | undefined,
  forInstall: boolean,
): AutomationTaskId[] {
  if (tasks !== undefined && tasks.length > 0) return dedupeTaskIds(tasks);
  return forInstall
    ? [...DEFAULT_AUTOMATION_TASK_IDS]
    : ["sync", "garden", "update"];
}

function dedupeTaskIds(tasks: AutomationTaskId[]): AutomationTaskId[] {
  const result: AutomationTaskId[] = [];
  for (const task of tasks) {
    if (!result.includes(task)) result.push(task);
  }
  return result;
}
