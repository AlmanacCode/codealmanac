import { shouldScheduleUpdateCheck } from "../../services/update/index.js";
import { spawnBackgroundUpdateCheck } from "../../platform/update/notifier-worker.js";

export function scheduleBackgroundUpdateCheck(argv: string[]): void {
  if (!shouldScheduleUpdateCheck({ argv, environment: process.env })) return;
  spawnBackgroundUpdateCheck(argv);
}
