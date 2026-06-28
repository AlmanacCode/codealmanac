import { findNearestAlmanacDir } from "../../stores/wiki-files/repo-location.js";
import { countWikiPageFilesSync } from "../../stores/wiki-files/pages.js";

export interface SetupWikiState {
  existingPageCount: number;
}

export function readSetupWikiState(cwd: string): SetupWikiState {
  const repoRoot = findNearestAlmanacDir(cwd);
  return {
    existingPageCount: repoRoot === null ? 0 : countExistingPages(repoRoot),
  };
}

function countExistingPages(repoRoot: string): number {
  try {
    return countWikiPageFilesSync(repoRoot);
  } catch {
    return 0;
  }
}
