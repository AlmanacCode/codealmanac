import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  LEGACY_CODEX_INSTRUCTIONS_END,
  LEGACY_CODEX_INSTRUCTIONS_START,
  hasCodexInstructions as hasSharedCodexInstructions,
  removeManagedBlock,
  upsertManagedBlock,
} from "../../../shared/setup-instructions.js";

// Codex treats @file references inside AGENTS.md as plain text rather than
// expanding them like Claude does in CLAUDE.md. Keep the managed instructions
// inline so they are actually present in Codex's prompt input.
export async function ensureCodexInstructions(
  codexDir: string,
  guideContents: string,
): Promise<boolean> {
  await mkdir(codexDir, { recursive: true });
  const agentsPath = await resolveCodexAgentsPath(codexDir);
  let existing = "";
  if (existsSync(agentsPath)) {
    existing = await readFile(agentsPath, "utf8");
  }

  const next = upsertManagedBlock(
    existing,
    CODEX_INSTRUCTIONS_START,
    CODEX_INSTRUCTIONS_END,
    formatCodexInstructions(guideContents),
  );
  if (next === existing) return false;
  await writeFile(agentsPath, next, "utf8");
  return true;
}

export async function removeCodexInstructions(codexDir: string): Promise<string[]> {
  const touched: string[] = [];
  for (const agentsFile of [
    path.join(codexDir, "AGENTS.md"),
    path.join(codexDir, "AGENTS.override.md"),
  ]) {
    if (!existsSync(agentsFile)) continue;
    const existing = await readFile(agentsFile, "utf8");
    const current = removeManagedBlock(
      existing,
      CODEX_INSTRUCTIONS_START,
      CODEX_INSTRUCTIONS_END,
    );
    const legacy = removeManagedBlock(
      current.body,
      LEGACY_CODEX_INSTRUCTIONS_START,
      LEGACY_CODEX_INSTRUCTIONS_END,
    );
    if (!current.changed && !legacy.changed) continue;
    if (legacy.body.trim().length === 0) {
      await rm(agentsFile, { force: true });
      touched.push(`${path.basename(agentsFile)} (deleted)`);
    } else {
      await writeFile(agentsFile, legacy.body, "utf8");
      touched.push(path.basename(agentsFile));
    }
  }
  return touched;
}

export async function codexInstructionBlockPresent(codexDir: string): Promise<boolean> {
  for (const file of ["AGENTS.override.md", "AGENTS.md"]) {
    const fullPath = path.join(codexDir, file);
    if (!existsSync(fullPath)) continue;
    try {
      if (hasCodexInstructions(await readFile(fullPath, "utf8"))) return true;
    } catch {
      // Treat unreadable files as absent for doctor-style checks.
    }
  }
  return false;
}

function formatCodexInstructions(guideContents: string): string {
  return `${CODEX_INSTRUCTIONS_START}
${guideContents.trimEnd()}
${CODEX_INSTRUCTIONS_END}`;
}

export async function resolveCodexAgentsPath(
  codexDir: string,
): Promise<string> {
  const overridePath = path.join(codexDir, "AGENTS.override.md");
  if (existsSync(overridePath)) {
    try {
      const body = await readFile(overridePath, "utf8");
      if (body.trim().length > 0) return overridePath;
    } catch {
      // Fall through to AGENTS.md and let the read/write surface errors.
    }
  }
  return path.join(codexDir, "AGENTS.md");
}

export function hasCodexInstructions(contents: string): boolean {
  return hasSharedCodexInstructions(contents);
}

export {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  LEGACY_CODEX_INSTRUCTIONS_END,
  LEGACY_CODEX_INSTRUCTIONS_START,
};
