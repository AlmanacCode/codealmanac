export {
  SETUP_DEFAULTS,
  resolveSetupPlan,
  shouldPromptForAutoCommit,
  shouldPromptForCliAutoUpdate,
  shouldPromptForSelfManagedAutomation,
} from "./setup-plan.js";
export type {
  SetupPlan,
  SetupPlanPromptInput,
  SetupPlanRequest,
} from "./setup-plan.js";
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
  saveSetupAgentChoice,
} from "./agent-choice.js";
export {
  resolveSetupAgentSelection,
} from "./agent-selection.js";
export {
  normalizeSetupProviderFixCommand,
  runnableSetupProviderFixCommand,
  runSetupProviderFixCommand,
} from "./provider-fix-command.js";
export {
  readSetupGlobalInstallState,
  runSetupGlobalInstall,
} from "./global-install.js";
export type {
  SetupAgentChoiceState,
  SetupAgentSelection,
  SetupAgentProviderId,
  SetupProviderModelChoice,
  SetupProviderView,
  SetupSpawnCliFn,
} from "./agent-choice-types.js";
export type {
  SetupProviderFixCommandRunner,
  SetupProviderFixCommandResult,
} from "./provider-fix-command.js";
export type {
  RunSetupGlobalInstallOptions,
  SetupGlobalInstallRuntime,
  SetupGlobalInstallResult,
  SetupGlobalInstallState,
  SetupGlobalInstallStateOptions,
} from "./global-install.js";
