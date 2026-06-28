import { existsSync, readdirSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { getRepoAlmanacDir } from "./repo-location.js";

export async function countWikiPageFiles(repoRoot: string): Promise<number> {
  const pagesDir = wikiPagesDir(repoRoot);
  if (!existsSync(pagesDir)) return 0;
  return countMarkdownEntries(await readdir(pagesDir));
}

export function countWikiPageFilesSync(repoRoot: string): number {
  const pagesDir = wikiPagesDir(repoRoot);
  if (!existsSync(pagesDir)) return 0;
  return countMarkdownEntries(readdirSync(pagesDir));
}

function wikiPagesDir(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "pages");
}

function countMarkdownEntries(entries: string[]): number {
  return entries.filter((entry) => entry.endsWith(".md")).length;
}
