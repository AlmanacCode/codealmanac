import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CLAUDE_IMPORT_LINE,
  ensureClaudeInstructions,
  hasClaudeImportLine,
  removeClaudeImportLine,
  removeClaudeInstructions,
  claudeInstructionsPresent,
} from "./instructions/claude.js";
import {
  codexInstructionBlockPresent,
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  ensureCodexInstructions,
  removeCodexInstructions,
} from "./instructions/codex.js";
import {
  cursorInstructionsPresent,
  ensureCursorInstructions,
  removeCursorInstructions,
} from "./instructions/cursor.js";
import {
  ensureOpenCodeInstructions,
  openCodeInstructionsPresent,
  removeOpenCodeInstructions,
} from "./instructions/opencode.js";
import {
  ensureWindsurfInstructions,
  removeWindsurfInstructions,
  windsurfInstructionsPresent,
} from "./instructions/windsurf.js";
import type {
  SetupInstructionInstallRequest,
  SetupInstructionRuntime,
} from "../../shared/setup-instructions.js";
export { CLAUDE_IMPORT_LINE, hasClaudeImportLine, removeClaudeImportLine };
export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  codexInstructionBlockPresent,
};

export type InstructionTargetId =
  | "claude"
  | "codex"
  | "cursor"
  | "windsurf"
  | "opencode";

export interface InstructionTarget {
  id: InstructionTargetId;
  displayName: string;
}

export const AGENT_INSTRUCTION_TARGETS: readonly InstructionTarget[] = [
  { id: "claude", displayName: "Claude Code" },
  { id: "codex", displayName: "Codex" },
  { id: "cursor", displayName: "Cursor" },
  { id: "windsurf", displayName: "Windsurf" },
  { id: "opencode", displayName: "OpenCode" },
];

export const DEFAULT_INSTRUCTION_TARGETS: readonly InstructionTargetId[] =
  AGENT_INSTRUCTION_TARGETS.map((target) => target.id);

export interface AgentInstructionDirs {
  claudeDir: string;
  codexDir: string;
  cursorDir: string;
  windsurfDir: string;
  opencodeDir: string;
}

export interface InstallAgentInstructionsOptions extends AgentInstructionDirs {
  guidesDir: string;
  targets?: readonly InstructionTargetId[];
}

export interface AgentInstructionsChange {
  anyChanges: boolean;
  filesTouched: string[];
}

export interface AgentInstructionCheck {
  ok: boolean;
  message: string;
  missing: string[];
}

export function createPlatformSetupInstructionRuntime(): SetupInstructionRuntime {
  return {
    install: (request) => installAgentInstructions(platformInstallOptions(request)),
    remove: removeAgentInstructions,
  };
}

export async function installAgentInstructions(
  options: InstallAgentInstructionsOptions,
): Promise<AgentInstructionsChange> {
  const srcMini = path.join(options.guidesDir, "mini.md");
  const srcRef = path.join(options.guidesDir, "reference.md");
  if (!existsSync(srcMini)) {
    throw new Error(`missing bundled guide: ${srcMini}`);
  }
  if (!existsSync(srcRef)) {
    throw new Error(`missing bundled guide: ${srcRef}`);
  }

  const miniContents = await readFile(srcMini, "utf8");
  const targets = options.targets ?? DEFAULT_INSTRUCTION_TARGETS;
  const touched: string[] = [];

  for (const target of targets) {
    touched.push(...await installInstructionTarget(target, {
      ...options,
      miniGuidePath: srcMini,
      referenceGuidePath: srcRef,
      miniContents,
    }));
  }

  return { anyChanges: touched.length > 0, filesTouched: touched };
}

export async function removeAgentInstructions(
  dirs: AgentInstructionDirs,
): Promise<AgentInstructionsChange> {
  const touched = [
    ...await removeClaudeInstructions(dirs.claudeDir),
    ...await removeCodexInstructions(dirs.codexDir),
    ...await removeCursorInstructions(dirs.cursorDir),
    ...await removeWindsurfInstructions(dirs.windsurfDir),
    ...await removeOpenCodeInstructions(dirs.opencodeDir),
  ];

  return { anyChanges: touched.length > 0, filesTouched: touched };
}

export async function checkAgentInstructions(
  dirs: AgentInstructionDirs,
): Promise<AgentInstructionCheck> {
  const missing = [
    ...await claudeInstructionsPresent(dirs.claudeDir),
    ...await codexInstructionsMissing(dirs.codexDir),
    ...cursorInstructionsPresent(dirs.cursorDir),
    ...await windsurfInstructionsPresent(dirs.windsurfDir),
    ...await openCodeInstructionsPresent(dirs.opencodeDir),
  ];

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length === 0
      ? "Agent instructions installed"
      : `Agent instructions missing (${missing.join(", ")})`,
  };
}

async function installInstructionTarget(
  target: InstructionTargetId,
  options: InstallAgentInstructionsOptions & {
    miniGuidePath: string;
    referenceGuidePath: string;
    miniContents: string;
  },
): Promise<string[]> {
  switch (target) {
    case "claude":
      return await ensureClaudeInstructions({
        claudeDir: options.claudeDir,
        miniGuidePath: options.miniGuidePath,
        referenceGuidePath: options.referenceGuidePath,
      });
    case "codex":
      return await ensureCodexInstructions(options.codexDir, options.miniContents)
        ? ["AGENTS.md"]
        : [];
    case "cursor":
      return await ensureCursorInstructions(options.cursorDir, options.miniContents);
    case "windsurf":
      return await ensureWindsurfInstructions(options.windsurfDir, options.miniContents);
    case "opencode":
      return await ensureOpenCodeInstructions(options.opencodeDir, options.miniContents);
    default: {
      const exhaustive: never = target;
      throw new Error(`unknown instruction target: ${exhaustive}`);
    }
  }
}

async function codexInstructionsMissing(codexDir: string): Promise<string[]> {
  if (await codexInstructionBlockPresent(codexDir)) return [];
  return ["Codex AGENTS.md instructions"];
}

function platformInstallOptions(
  request: SetupInstructionInstallRequest,
): InstallAgentInstructionsOptions {
  return {
    targets: request.targets,
    claudeDir: request.claudeDir ?? path.join(request.homeDir, ".claude"),
    codexDir: request.codexDir ?? path.join(request.homeDir, ".codex"),
    cursorDir: request.cursorDir ?? path.join(request.homeDir, ".cursor"),
    windsurfDir: request.windsurfDir ??
      path.join(request.homeDir, ".codeium", "windsurf"),
    opencodeDir: request.opencodeDir ??
      path.join(request.homeDir, ".config", "opencode"),
    guidesDir: request.guidesDir,
  };
}
