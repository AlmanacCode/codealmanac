import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import fg from "fast-glob";

// Glob is relative to `.almanac/pages/`, so this is every markdown page
// beneath pages without repeating the `pages/` prefix.
export const PAGES_GLOB = "**/*.md";

/**
 * Return true if any page file has an mtime strictly greater than the
 * index DB's mtime.
 */
export function pagesNewerThan(pagesDir: string, dbPath: string): boolean {
  let dbMtime: number;
  try {
    dbMtime = statSync(dbPath).mtimeMs;
  } catch {
    return true;
  }

  const entries = fg.sync(PAGES_GLOB, {
    cwd: pagesDir,
    absolute: true,
    onlyFiles: true,
    stats: true,
  }) as Array<{ path: string; stats?: { mtimeMs: number } }>;

  for (const entry of entries) {
    const mtime = entry.stats?.mtimeMs;
    if (mtime !== undefined && mtime > dbMtime) return true;
  }
  return false;
}

/**
 * Return true if `topics.yaml` has an mtime strictly greater than the
 * index DB's mtime.
 */
export function topicsYamlNewerThan(
  almanacDir: string,
  dbPath: string,
): boolean {
  const path = join(almanacDir, "topics.yaml");
  if (!existsSync(path)) return false;
  let dbMtime: number;
  try {
    dbMtime = statSync(dbPath).mtimeMs;
  } catch {
    return true;
  }
  try {
    const st = statSync(path);
    return st.mtimeMs > dbMtime;
  } catch {
    return false;
  }
}
