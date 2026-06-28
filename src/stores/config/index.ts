export {
  parseConfigText,
  serializeConfig,
} from "./codec.js";
export {
  deleteNestedConfigValue,
  readConfigObject,
  setNestedConfigValue,
  writeConfigObject,
} from "./editor.js";
export {
  getConfigPath,
  getLegacyConfigPath,
  getProjectConfigPath,
} from "./paths.js";
export type {
  ConfigOrigin,
} from "./origins.js";
export {
  defaultConfig,
  type AgentConfig,
  type AutomationConfig,
  type GlobalConfig,
} from "./schema.js";
export {
  ensureAutomationSyncSince,
  readConfig,
  readConfigSync,
  readConfigWithOrigins,
  writeConfig,
  type ConfigReadOptions,
  type ConfigReadResult,
} from "./store.js";
