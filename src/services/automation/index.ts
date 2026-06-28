export {
  installAutomation,
  readAutomationStatus,
  uninstallAutomation,
} from "./automation.js";
export {
  automationTaskLabel,
  parseAutomationTaskIds,
} from "./catalog.js";
export {
  cleanupLegacyAutomationHooks,
} from "./legacy-hooks.js";
export {
  migrateLegacyAutomation,
} from "./migration.js";
export type {
  AutomationInstallOptions,
  AutomationInstallResult,
  AutomationTaskId,
  AutomationStatusOptions,
  AutomationStatusResult,
  AutomationStatusSection,
  AutomationUninstallOptions,
  AutomationUninstallResult,
  InstalledAutomationTask,
} from "./types.js";
export type {
  CleanupLegacyAutomationHooksOptions,
} from "./legacy-hooks.js";
export type {
  MigrateLegacyAutomationOptions,
  MigrateLegacyAutomationResult,
} from "./migration.js";
export type {
  AutomationExecFn,
  AutomationScheduler,
  AutomationSchedulerJob,
  AutomationSchedulerJobInput,
  AutomationSchedulerJobStatus,
  LegacyAutomationJob,
} from "./scheduler.js";
