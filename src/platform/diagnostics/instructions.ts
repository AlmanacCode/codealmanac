import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import {
  checkAgentInstructions,
  type AgentInstructionDirs,
} from "../setup/instructions.js";
import type {
  DiagnosticsGuideStatus,
  DiagnosticsInstructionEntriesStatus,
} from "../../shared/diagnostics.js";

export interface InstructionDiagnosticsProbeOptions {
  homeDir?: string;
  claudeDir?: string;
  codexDir?: string;
  cursorDir?: string;
  windsurfDir?: string;
  opencodeDir?: string;
}

export function probeDiagnosticGuides(
  options: Pick<InstructionDiagnosticsProbeOptions, "claudeDir" | "homeDir"> = {},
): DiagnosticsGuideStatus {
  const dirs = instructionDirs(options);
  const guideNames = ["almanac.md", "almanac-reference.md"];
  const missingNames = guideNames.filter(
    (name) => !existsSync(path.join(dirs.claudeDir, name)),
  );
  return missingNames.length === 0
    ? { status: "installed", installedNames: guideNames }
    : { status: "missing", missingNames };
}

export async function probeDiagnosticInstructionEntries(
  options: InstructionDiagnosticsProbeOptions = {},
): Promise<DiagnosticsInstructionEntriesStatus> {
  const check = await checkAgentInstructions(instructionDirs(options));
  return check.ok
    ? { status: "present" }
    : { status: "missing", missing: check.missing };
}

function instructionDirs(
  options: InstructionDiagnosticsProbeOptions,
): AgentInstructionDirs {
  const home = options.homeDir ?? homedir();
  return {
    claudeDir: options.claudeDir ?? path.join(home, ".claude"),
    codexDir: options.codexDir ?? path.join(home, ".codex"),
    cursorDir: options.cursorDir ?? path.join(home, ".cursor"),
    windsurfDir: options.windsurfDir ?? path.join(home, ".codeium", "windsurf"),
    opencodeDir: options.opencodeDir ?? path.join(home, ".config", "opencode"),
  };
}
