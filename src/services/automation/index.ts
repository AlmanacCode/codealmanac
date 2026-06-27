export {
  installAutomation,
  readAutomationStatus,
  uninstallAutomation,
} from "./automation.js";
export {
  migrateLegacyAutomation,
} from "./migration.js";
export type {
  AutomationInstallOptions,
  AutomationInstallResult,
  AutomationStatusOptions,
  AutomationStatusResult,
  AutomationStatusSection,
  AutomationUninstallOptions,
  AutomationUninstallResult,
  InstalledAutomationTask,
} from "./types.js";
export type {
  MigrateLegacyAutomationOptions,
  MigrateLegacyAutomationResult,
} from "./migration.js";
