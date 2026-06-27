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
  resolveSetupGuidesDir,
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
} from "./agent-choice.js";
export type {
  ProviderSetupView,
} from "../../agent/readiness/view.js";
export type {
  ProviderModelChoice,
} from "../../agent/types.js";
export type {
  AgentProviderId,
} from "../../config/index.js";
