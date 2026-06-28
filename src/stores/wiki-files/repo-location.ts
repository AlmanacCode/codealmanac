import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { getGlobalAlmanacDir } from "../global-paths.js";

/**
 * Repo-level `.almanac/` path for a repo root.
 */
export function getRepoAlmanacDir(repoRoot: string): string {
  return join(repoRoot, ".almanac");
}

/**
 * Walk upward from `startDir` looking for a directory that contains
 * `.almanac/`. Returns the repo root, or `null` if none is found.
 */
export function findNearestAlmanacDir(startDir: string): string | null {
  const globalDir = getGlobalAlmanacDir();
  let current = isAbsolute(startDir) ? startDir : resolve(startDir);

  while (true) {
    const candidate = join(current, ".almanac");
    if (candidate !== globalDir && existsSync(candidate)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export function resolveNearestWikiRootOrCwd(cwd: string): string {
  return findNearestAlmanacDir(cwd) ?? resolve(cwd);
}
