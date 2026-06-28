import {
  automationTaskDefinition,
  type AutomationTaskDefinition,
} from "./tasks.js";
import {
  buildAutomationSchedulerJob,
  plistPathForTask,
} from "./job-planning.js";
import { resolveAutomationTaskSchedule } from "./task-schedule.js";
import { selectAutomationInstallTasks } from "./task-selection.js";
import type { AutomationInstallOptions } from "./types.js";
import type {
  AutomationScheduler,
  AutomationSchedulerJob,
} from "../../shared/automation-scheduler.js";

export interface PlannedAutomationJob {
  task: AutomationTaskDefinition;
  intervalInput: string;
  job: AutomationSchedulerJob;
}

export interface AutomationInstallPlan {
  jobs: PlannedAutomationJob[];
  disabledGardenPlistPath: string | null;
}

export function buildAutomationInstallPlan(
  options: AutomationInstallOptions,
  scheduler: AutomationScheduler,
): { ok: true; value: AutomationInstallPlan } | { ok: false; error: string } {
  const selection = selectAutomationInstallTasks(options);
  if (!selection.ok) return selection;

  const jobs: PlannedAutomationJob[] = [];

  for (const taskId of selection.value.taskIds) {
    const task = automationTaskDefinition(taskId);
    const schedule = resolveAutomationTaskSchedule(
      taskId,
      options,
      selection.value.explicitTasks,
    );
    if (!schedule.ok) return schedule;
    jobs.push({
      task,
      intervalInput: schedule.value.intervalInput,
      job: buildAutomationSchedulerJob(
        task,
        options,
        scheduler,
        schedule.value.intervalSeconds,
      ),
    });
  }

  return {
    ok: true,
    value: {
      jobs,
      disabledGardenPlistPath:
        options.gardenOff === true && !selection.value.explicitTasks
          ? plistPathForTask(
            automationTaskDefinition("garden"),
            options.homeDir,
            options,
            scheduler,
          )
          : null,
    },
  };
}
