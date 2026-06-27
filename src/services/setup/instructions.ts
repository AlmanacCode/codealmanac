import path from "node:path";

import {
  AGENT_INSTRUCTION_TARGETS,
  CLAUDE_IMPORT_LINE,
  hasClaudeImportLine,
  installAgentInstructions,
  type InstructionTarget,
} from "../../agent/install-targets.js";
import {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
} from "../../agent/instructions/codex.js";

export type SetupInstructionTargetId =
  | "claude"
  | "codex"
  | "cursor"
  | "windsurf"
  | "opencode";

export interface SetupInstructionTarget {
  id: SetupInstructionTargetId;
  displayName: string;
}

export interface SetupInstructionsChange {
  anyChanges: boolean;
  filesTouched: string[];
}

export const SETUP_IMPORT_LINE = CLAUDE_IMPORT_LINE;

export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
};

export const SETUP_INSTRUCTION_TARGETS: readonly SetupInstructionTarget[] =
  AGENT_INSTRUCTION_TARGETS.map(setupInstructionTargetFromAgentTarget);

export const DEFAULT_SETUP_INSTRUCTION_TARGETS:
  readonly SetupInstructionTargetId[] = SETUP_INSTRUCTION_TARGETS.map(
    (target) => target.id,
  );

export interface InstallSetupInstructionsOptions {
  targets: readonly SetupInstructionTargetId[];
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
  guidesDir: string;
  homeDir: string;
}

export async function installSetupInstructions(
  options: InstallSetupInstructionsOptions,
): Promise<SetupInstructionsChange> {
  const change = await installAgentInstructions({
    targets: options.targets,
    claudeDir: options.claudeDir ?? path.join(options.homeDir, ".claude"),
    codexDir: options.codexDir ?? path.join(options.homeDir, ".codex"),
    cursorDir: options.cursorDir ?? path.join(options.homeDir, ".cursor"),
    windsurfDir: options.windsurfDir ?? path.join(options.homeDir, ".codeium", "windsurf"),
    opencodeDir: options.opencodeDir ?? path.join(options.homeDir, ".config", "opencode"),
    guidesDir: options.guidesDir,
  });
  return {
    anyChanges: change.anyChanges,
    filesTouched: change.filesTouched,
  };
}

export function hasSetupImportLine(contents: string): boolean {
  return hasClaudeImportLine(contents);
}

function setupInstructionTargetFromAgentTarget(
  target: InstructionTarget,
): SetupInstructionTarget {
  return {
    id: target.id,
    displayName: target.displayName,
  };
}
