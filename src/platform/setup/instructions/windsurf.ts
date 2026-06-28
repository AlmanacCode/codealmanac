import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  removeManagedBlock,
  upsertManagedBlock,
} from "../../../shared/setup-instructions.js";

export const WINDSURF_INSTRUCTIONS_START = "<!-- almanac:start -->";
export const WINDSURF_INSTRUCTIONS_END = "<!-- almanac:end -->";

export function windsurfGlobalRulesPath(windsurfDir: string): string {
  return path.join(windsurfDir, "memories", "global_rules.md");
}

export async function ensureWindsurfInstructions(
  windsurfDir: string,
  guideContents: string,
): Promise<string[]> {
  const rulesPath = windsurfGlobalRulesPath(windsurfDir);
  await mkdir(path.dirname(rulesPath), { recursive: true });
  let existing = "";
  if (existsSync(rulesPath)) {
    existing = await readFile(rulesPath, "utf8");
  }
  const next = upsertManagedBlock(
    existing,
    WINDSURF_INSTRUCTIONS_START,
    WINDSURF_INSTRUCTIONS_END,
    formatWindsurfInstructions(guideContents),
  );
  if (next === existing) return [];
  await writeFile(rulesPath, next, "utf8");
  return ["Windsurf global_rules.md"];
}

export async function removeWindsurfInstructions(windsurfDir: string): Promise<string[]> {
  const rulesPath = windsurfGlobalRulesPath(windsurfDir);
  if (!existsSync(rulesPath)) return [];
  const existing = await readFile(rulesPath, "utf8");
  const current = removeManagedBlock(
    existing,
    WINDSURF_INSTRUCTIONS_START,
    WINDSURF_INSTRUCTIONS_END,
  );
  if (!current.changed) return [];
  await writeFile(rulesPath, current.body, "utf8");
  return ["Windsurf global_rules.md"];
}

export async function windsurfInstructionsPresent(windsurfDir: string): Promise<string[]> {
  const rulesPath = windsurfGlobalRulesPath(windsurfDir);
  if (!existsSync(rulesPath)) return ["Windsurf global_rules.md"];
  try {
    const contents = await readFile(rulesPath, "utf8");
    if (
      contents.includes(WINDSURF_INSTRUCTIONS_START) &&
      contents.includes(WINDSURF_INSTRUCTIONS_END)
    ) {
      return [];
    }
  } catch {
    // Treat unreadable files as absent for doctor-style checks.
  }
  return ["Windsurf global_rules.md"];
}

function formatWindsurfInstructions(guideContents: string): string {
  return `${WINDSURF_INSTRUCTIONS_START}
${guideContents.trimEnd()}
${WINDSURF_INSTRUCTIONS_END}`;
}
