import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  removeManagedBlock,
  upsertManagedBlock,
} from "../../../shared/setup-instructions.js";

export const OPENCODE_INSTRUCTIONS_START = "<!-- almanac:start -->";
export const OPENCODE_INSTRUCTIONS_END = "<!-- almanac:end -->";

export function opencodeAgentsPath(opencodeDir: string): string {
  return path.join(opencodeDir, "AGENTS.md");
}

export async function ensureOpenCodeInstructions(
  opencodeDir: string,
  guideContents: string,
): Promise<string[]> {
  const agentsPath = opencodeAgentsPath(opencodeDir);
  await mkdir(path.dirname(agentsPath), { recursive: true });
  let existing = "";
  if (existsSync(agentsPath)) {
    existing = await readFile(agentsPath, "utf8");
  }
  const next = upsertManagedBlock(
    existing,
    OPENCODE_INSTRUCTIONS_START,
    OPENCODE_INSTRUCTIONS_END,
    formatOpenCodeInstructions(guideContents),
  );
  if (next === existing) return [];
  await writeFile(agentsPath, next, "utf8");
  return ["OpenCode AGENTS.md"];
}

export async function removeOpenCodeInstructions(opencodeDir: string): Promise<string[]> {
  const agentsPath = opencodeAgentsPath(opencodeDir);
  if (!existsSync(agentsPath)) return [];
  const existing = await readFile(agentsPath, "utf8");
  const current = removeManagedBlock(
    existing,
    OPENCODE_INSTRUCTIONS_START,
    OPENCODE_INSTRUCTIONS_END,
  );
  if (!current.changed) return [];
  if (current.body.trim().length === 0) {
    await rm(agentsPath, { force: true });
    return ["OpenCode AGENTS.md (deleted)"];
  }
  await writeFile(agentsPath, current.body, "utf8");
  return ["OpenCode AGENTS.md"];
}

export async function openCodeInstructionsPresent(opencodeDir: string): Promise<string[]> {
  const agentsPath = opencodeAgentsPath(opencodeDir);
  if (!existsSync(agentsPath)) return ["OpenCode AGENTS.md"];
  try {
    const contents = await readFile(agentsPath, "utf8");
    if (
      contents.includes(OPENCODE_INSTRUCTIONS_START) &&
      contents.includes(OPENCODE_INSTRUCTIONS_END)
    ) {
      return [];
    }
  } catch {
    // Treat unreadable files as absent for doctor-style checks.
  }
  return ["OpenCode AGENTS.md"];
}

function formatOpenCodeInstructions(guideContents: string): string {
  return `${OPENCODE_INSTRUCTIONS_START}
${guideContents.trimEnd()}
${OPENCODE_INSTRUCTIONS_END}`;
}
