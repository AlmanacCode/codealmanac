export {
  applySetupAutoCommit,
} from "./auto-commit.js";
export type {
  SetupAutoCommitResult,
} from "./auto-commit.js";
export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  DEFAULT_SETUP_INSTRUCTION_TARGETS,
  SETUP_IMPORT_LINE,
  SETUP_INSTRUCTION_TARGETS,
  hasCodexInstructions,
  hasSetupImportLine,
  installSetupInstructions,
} from "./instructions.js";
export type {
  InstallSetupInstructionsOptions,
  SetupInstructionTarget,
  SetupInstructionTargetId,
} from "./instructions.js";
export {
  removeSetupImportLine,
  removeSetupManagedBlock,
  uninstallSetup,
} from "./uninstall.js";
export type {
  SetupUninstallOptions,
  SetupUninstallResult,
} from "./uninstall.js";
export {
  readSetupAgentChoiceState,
  readSetupProviderModelChoices,
  refreshSetupAgentChoiceView,
  resolveSetupAgentSelection,
  saveSetupAgentChoice,
} from "./agent-choice.js";
export type {
  SetupAgentChoiceState,
  SetupAgentSelection,
  SetupAgentProviderId,
  SetupProviderModelChoice,
  SetupProviderView,
  SetupSpawnCliFn,
} from "./agent-choice.js";
export {
  readSetupWikiState,
} from "./wiki-state.js";
export type {
  SetupWikiState,
} from "./wiki-state.js";
