import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  CODEX_INSTRUCTIONS_END,
  CODEX_INSTRUCTIONS_START,
  ensureCodexInstructions,
  hasCodexInstructions,
} from "./providers/codex-instructions.js";

export const CLAUDE_IMPORT_LINE = "@~/.claude/almanac.md";
export const LEGACY_CLAUDE_IMPORT_LINE = "@~/.claude/codealmanac.md";
export const LEGACY_CODEX_INSTRUCTIONS_START = "<!-- codealmanac:start -->";
export const LEGACY_CODEX_INSTRUCTIONS_END = "<!-- codealmanac:end -->";

export interface AgentInstructionDirs {
  claudeDir: string;
  codexDir: string;
}

export interface InstallAgentInstructionsOptions extends AgentInstructionDirs {
  guidesDir: string;
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

type InstructionTarget = {
  id: "claude" | "codex";
  displayName: string;
};

export const AGENT_INSTRUCTION_TARGETS: readonly InstructionTarget[] = [
  { id: "claude", displayName: "Claude" },
  { id: "codex", displayName: "Codex" },
];

export async function installAgentInstructions(
  options: InstallAgentInstructionsOptions,
): Promise<AgentInstructionsChange> {
  await mkdir(options.claudeDir, { recursive: true });

  const srcMini = path.join(options.guidesDir, "mini.md");
  const srcRef = path.join(options.guidesDir, "reference.md");
  if (!existsSync(srcMini)) {
    throw new Error(`missing bundled guide: ${srcMini}`);
  }
  if (!existsSync(srcRef)) {
    throw new Error(`missing bundled guide: ${srcRef}`);
  }

  const miniContents = await readFile(srcMini, "utf8");
  const touched: string[] = [];

  if (await copyIfChanged(srcMini, path.join(options.claudeDir, "almanac.md"))) {
    touched.push("almanac.md");
  }
  if (
    await copyIfChanged(srcRef, path.join(options.claudeDir, "almanac-reference.md"))
  ) {
    touched.push("almanac-reference.md");
  }
  if (await ensureClaudeImport(path.join(options.claudeDir, "CLAUDE.md"))) {
    touched.push("CLAUDE.md");
  }
  if (await ensureCodexInstructions(options.codexDir, miniContents)) {
    touched.push("AGENTS.md");
  }

  return { anyChanges: touched.length > 0, filesTouched: touched };
}

export async function removeAgentInstructions(
  dirs: AgentInstructionDirs,
): Promise<AgentInstructionsChange> {
  const touched: string[] = [];
  const guideFiles = [
    "almanac.md",
    "almanac-reference.md",
    "codealmanac.md",
    "codealmanac-reference.md",
  ];
  const claudeMd = path.join(dirs.claudeDir, "CLAUDE.md");

  for (const file of guideFiles) {
    const fullPath = path.join(dirs.claudeDir, file);
    if (existsSync(fullPath)) {
      await rm(fullPath, { force: true });
      touched.push(file);
    }
  }

  if (existsSync(claudeMd)) {
    const existing = await readFile(claudeMd, "utf8");
    const { changed, body } = removeClaudeImportLine(existing);
    if (changed) {
      if (body.trim().length === 0) {
        await rm(claudeMd, { force: true });
        touched.push("CLAUDE.md (deleted)");
      } else {
        await writeFile(claudeMd, body, "utf8");
        touched.push("CLAUDE.md");
      }
    }
  }

  for (const agentsFile of [
    path.join(dirs.codexDir, "AGENTS.md"),
    path.join(dirs.codexDir, "AGENTS.override.md"),
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

  return { anyChanges: touched.length > 0, filesTouched: touched };
}

export async function checkAgentInstructions(
  dirs: AgentInstructionDirs,
): Promise<AgentInstructionCheck> {
  const missing: string[] = [];
  const claudeMini = path.join(dirs.claudeDir, "almanac.md");
  const claudeRef = path.join(dirs.claudeDir, "almanac-reference.md");
  const claudeMd = path.join(dirs.claudeDir, "CLAUDE.md");

  if (!existsSync(claudeMini)) missing.push("Claude almanac.md");
  if (!existsSync(claudeRef)) missing.push("Claude almanac-reference.md");
  if (!existsSync(claudeMd)) {
    missing.push("Claude CLAUDE.md import");
  } else {
    try {
      const contents = await readFile(claudeMd, "utf8");
      if (!hasClaudeImportLine(contents)) missing.push("Claude CLAUDE.md import");
    } catch {
      missing.push("Claude CLAUDE.md import");
    }
  }

  if (!await codexInstructionBlockPresent(dirs.codexDir)) {
    missing.push("Codex AGENTS.md instructions");
  }

  return {
    ok: missing.length === 0,
    missing,
    message: missing.length === 0
      ? "Agent instructions installed for Claude and Codex"
      : `Agent instructions missing (${missing.join(", ")})`,
  };
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

async function copyIfChanged(src: string, dest: string): Promise<boolean> {
  const srcBytes = await readFile(src);
  if (existsSync(dest)) {
    try {
      const destBytes = await readFile(dest);
      if (srcBytes.equals(destBytes)) return false;
    } catch {
      // Fall through to write.
    }
  }
  await copyFile(src, dest);
  return true;
}

async function ensureClaudeImport(claudeMdPath: string): Promise<boolean> {
  let existing = "";
  if (existsSync(claudeMdPath)) {
    existing = await readFile(claudeMdPath, "utf8");
  }
  if (hasClaudeImportLine(existing)) return false;

  const sep =
    existing.length === 0 ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(claudeMdPath, `${existing}${sep}${CLAUDE_IMPORT_LINE}\n`, "utf8");
  return true;
}

export function hasClaudeImportLine(contents: string): boolean {
  const lines = contents.split(/\r?\n/).map((line) => line.trim());
  return lines.some((line) => isImportLineFor(line, CLAUDE_IMPORT_LINE));
}

export function removeClaudeImportLine(contents: string): {
  changed: boolean;
  body: string;
} {
  const eol = contents.includes("\r\n") ? "\r\n" : "\n";
  const lines = contents.split(/\r?\n/);
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (
      isImportLineFor(line, CLAUDE_IMPORT_LINE) ||
      isImportLineFor(line, LEGACY_CLAUDE_IMPORT_LINE)
    ) {
      indices.push(i);
    }
  }
  if (indices.length === 0) return { changed: false, body: contents };

  for (let i = indices.length - 1; i >= 0; i--) {
    lines.splice(indices[i]!, 1);
  }

  return {
    changed: true,
    body: lines.join(eol).replace(/\n\n\n+/g, "\n\n"),
  };
}

export function removeManagedBlock(
  contents: string,
  start: string,
  end: string,
): { changed: boolean; body: string } {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return { changed: false, body: contents };
  }

  const afterEnd = endIndex + end.length;
  let body = `${contents.slice(0, startIndex)}${contents.slice(afterEnd)}`;
  body = body.replace(/\n\n\n+/g, "\n\n");
  body = body.replace(/^\n+/, "");
  return { changed: true, body };
}

function isImportLineFor(line: string, importLine: string): boolean {
  if (line === importLine) return true;
  const rest = line.slice(importLine.length);
  return line.startsWith(importLine) && /^[\t ]/.test(rest);
}
