import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

export interface SetupWikiState {
  existingPageCount: number;
}

export function readSetupWikiState(cwd: string): SetupWikiState {
  return {
    existingPageCount: countExistingPages(cwd),
  };
}

function countExistingPages(cwd: string): number {
  try {
    let dir = cwd;
    for (let i = 0; i < 10; i++) {
      const pagesDir = path.join(dir, ".almanac", "pages");
      if (existsSync(pagesDir)) {
        return countMarkdownFiles(pagesDir);
      }

      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    return 0;
  }

  return 0;
}

function countMarkdownFiles(dir: string): number {
  try {
    return readdirSync(dir).filter((entry) => entry.endsWith(".md")).length;
  } catch {
    return 0;
  }
}
