import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AGENT_INSTRUCTION_TARGETS,
  CLAUDE_IMPORT_LINE,
  DEFAULT_INSTRUCTION_TARGETS,
  hasClaudeImportLine,
  installAgentInstructions,
  type AgentInstructionsChange,
  type InstructionTarget,
  type InstructionTargetId,
} from "../../agent/install-targets.js";
import {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
} from "../../agent/instructions/codex.js";

export type SetupInstructionTargetId = InstructionTargetId;
export type SetupInstructionTarget = InstructionTarget;

export const SETUP_IMPORT_LINE = CLAUDE_IMPORT_LINE;

export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  hasCodexInstructions,
};

export const SETUP_INSTRUCTION_TARGETS: readonly SetupInstructionTarget[] =
  AGENT_INSTRUCTION_TARGETS;

export const DEFAULT_SETUP_INSTRUCTION_TARGETS:
  readonly SetupInstructionTargetId[] = DEFAULT_INSTRUCTION_TARGETS;

export interface InstallSetupInstructionsOptions {
  targets: readonly SetupInstructionTargetId[];
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
  guidesDir?: string;
  homeDir?: string;
}

export async function installSetupInstructions(
  options: InstallSetupInstructionsOptions,
): Promise<AgentInstructionsChange> {
  const home = options.homeDir ?? homedir();
  return await installAgentInstructions({
    targets: options.targets,
    claudeDir: options.claudeDir ?? path.join(home, ".claude"),
    codexDir: options.codexDir ?? path.join(home, ".codex"),
    cursorDir: options.cursorDir ?? path.join(home, ".cursor"),
    windsurfDir: options.windsurfDir ?? path.join(home, ".codeium", "windsurf"),
    opencodeDir: options.opencodeDir ?? path.join(home, ".config", "opencode"),
    guidesDir: options.guidesDir ?? resolveSetupGuidesDir(),
  });
}

export function hasSetupImportLine(contents: string): boolean {
  return hasClaudeImportLine(contents);
}

/**
 * Locate `guides/` relative to the installed package. Mirrors
 * `resolvePromptsDir` from `src/agent/prompts.ts`.
 */
export function resolveSetupGuidesDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "guides"), // dist layout
    path.resolve(here, "..", "..", "guides"), // src layout
    path.resolve(here, "..", "..", "..", "guides"),
  ];
  for (const dir of candidates) {
    if (looksLikeGuidesDir(dir)) return dir;
  }
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve("codealmanac/package.json");
    const guides = path.join(path.dirname(pkgJson), "guides");
    if (looksLikeGuidesDir(guides)) return guides;
  } catch {
    // Fall through to the detailed error below.
  }
  throw new Error(
    "could not locate bundled guides/ directory. Tried:\n" +
      candidates.map((c) => `  - ${c}`).join("\n"),
  );
}

function looksLikeGuidesDir(dir: string): boolean {
  return existsSync(path.join(dir, "mini.md"));
}
