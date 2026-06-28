export { runUpdateWorkflow } from "./update.js";
export { checkForUpdate, type CheckForUpdateOptions } from "./check.js";
export {
  readUpdateAnnouncement,
  readUpdateNotifierEnabled,
  shouldScheduleUpdateCheck,
  type UpdateAnnouncement,
  type UpdateAnnouncementOptions,
  type UpdateCheckScheduleOptions,
} from "./notifier.js";
export type {
  UpdateCheckFn,
  UpdateInstallFn,
  UpdateInstallResult,
  UpdateOptions,
  UpdateRuntime,
  UpdateWorkflowResult,
} from "./types.js";
