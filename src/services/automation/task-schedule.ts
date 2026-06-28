import {
  DEFAULT_GARDEN_INTERVAL,
  DEFAULT_SYNC_INTERVAL,
  DEFAULT_SYNC_QUIET,
  DEFAULT_UPDATE_INTERVAL,
} from "./tasks.js";
import { parseDuration } from "../../shared/duration.js";
import type {
  AutomationInstallOptions,
  AutomationTaskId,
} from "./types.js";

export interface AutomationTaskSchedule {
  intervalInput: string;
  intervalSeconds: number;
}

export function resolveAutomationTaskSchedule(
  taskId: AutomationTaskId,
  options: AutomationInstallOptions,
  explicitTasks: boolean,
): { ok: true; value: AutomationTaskSchedule } | { ok: false; error: string } {
  if (taskId === "sync") {
    const quiet = parseQuietWindow(options.quiet ?? DEFAULT_SYNC_QUIET);
    if (!quiet.ok) return quiet;
  }

  const intervalInput = intervalInputForTask(taskId, options, explicitTasks);
  const interval = parseAutomationInterval(intervalInput);
  if (!interval.ok) return interval;

  return {
    ok: true,
    value: {
      intervalInput,
      intervalSeconds: interval.seconds,
    },
  };
}

function intervalInputForTask(
  taskId: AutomationTaskId,
  options: AutomationInstallOptions,
  explicitTasks: boolean,
): string {
  if (taskId === "sync") return options.every ?? DEFAULT_SYNC_INTERVAL;
  if (taskId === "garden") {
    return options.gardenEvery ??
      (
        explicitTasks
          ? options.every ?? DEFAULT_GARDEN_INTERVAL
          : DEFAULT_GARDEN_INTERVAL
      );
  }
  return options.every ?? DEFAULT_UPDATE_INTERVAL;
}

function parseAutomationInterval(
  value: string,
): { ok: true; seconds: number } | { ok: false; error: string } {
  try {
    const seconds = parseDuration(value);
    if (seconds <= 0) {
      return { ok: false, error: "automation interval must be greater than zero" };
    }
    return { ok: true, seconds };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function parseQuietWindow(value: string): { ok: true } | { ok: false; error: string } {
  try {
    const seconds = parseDuration(value);
    if (seconds < 0) {
      return { ok: false, error: "quiet window must be zero or greater" };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
