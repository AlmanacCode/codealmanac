import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function cursorRulePath(cursorDir: string): string {
  return path.join(cursorDir, "rules", "almanac", "RULE.md");
}

export async function ensureCursorInstructions(
  cursorDir: string,
  guideContents: string,
): Promise<string[]> {
  const rulePath = cursorRulePath(cursorDir);
  await mkdir(path.dirname(rulePath), { recursive: true });
  const next = formatCursorRule(guideContents);
  let existing = "";
  if (existsSync(rulePath)) {
    existing = await readFile(rulePath, "utf8");
  }
  if (existing === next) return [];
  await writeFile(rulePath, next, "utf8");
  return ["Cursor RULE.md"];
}

export async function removeCursorInstructions(cursorDir: string): Promise<string[]> {
  const rulePath = cursorRulePath(cursorDir);
  if (!existsSync(rulePath)) return [];
  await rm(rulePath, { force: true });
  return ["Cursor RULE.md"];
}

export function cursorInstructionsPresent(cursorDir: string): string[] {
  return existsSync(cursorRulePath(cursorDir)) ? [] : ["Cursor RULE.md"];
}

function formatCursorRule(guideContents: string): string {
  return `---
alwaysApply: true
description: "Almanac instructions for Cursor"
---

${guideContents.trimEnd()}
`;
}
