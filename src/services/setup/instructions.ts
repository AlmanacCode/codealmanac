import {
  DEFAULT_SETUP_INSTRUCTION_TARGETS,
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  SETUP_IMPORT_LINE,
  SETUP_INSTRUCTION_TARGETS,
  hasCodexInstructions,
  hasSetupImportLine,
  type SetupInstructionRuntime,
  type SetupInstructionsChange,
  type SetupInstructionTarget,
  type SetupInstructionTargetId,
} from "../../shared/setup-instructions.js";

export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  DEFAULT_SETUP_INSTRUCTION_TARGETS,
  SETUP_IMPORT_LINE,
  SETUP_INSTRUCTION_TARGETS,
  hasCodexInstructions,
  hasSetupImportLine,
  type SetupInstructionRuntime,
  type SetupInstructionsChange,
  type SetupInstructionTarget,
  type SetupInstructionTargetId,
};

export interface InstallSetupInstructionsOptions {
  targets: readonly SetupInstructionTargetId[];
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
  guidesDir: string;
  homeDir: string;
  instructionsRuntime: SetupInstructionRuntime;
}

export async function installSetupInstructions(
  options: InstallSetupInstructionsOptions,
): Promise<SetupInstructionsChange> {
  return await options.instructionsRuntime.install({
    targets: options.targets,
    homeDir: options.homeDir,
    claudeDir: options.claudeDir,
    codexDir: options.codexDir,
    cursorDir: options.cursorDir,
    windsurfDir: options.windsurfDir,
    opencodeDir: options.opencodeDir,
    guidesDir: options.guidesDir,
  });
}
