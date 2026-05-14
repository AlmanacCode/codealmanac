import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const CODEX_INSTRUCTIONS_START = "<!-- almanac:start -->";
export const CODEX_INSTRUCTIONS_END = "<!-- almanac:end -->";

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
  return (
    contents.includes(CODEX_INSTRUCTIONS_START) &&
    contents.includes(CODEX_INSTRUCTIONS_END)
  );
}

function upsertManagedBlock(
  contents: string,
  start: string,
  end: string,
  block: string,
): string {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const afterEnd = endIndex + end.length;
    return `${contents.slice(0, startIndex)}${block}${contents.slice(afterEnd)}`;
  }

  const sep =
    contents.length === 0 ? "" : contents.endsWith("\n") ? "\n" : "\n\n";
  return `${contents}${sep}${block}\n`;
}
