import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fg from "fast-glob";

import {
  applyTopicsTransform,
  rewritePageTopics,
} from "../../topics/frontmatterRewrite.js";

/**
 * Apply a `topic-list transform` to every `.almanac/pages/*.md` file
 * whose frontmatter contains a relevant topic. Returns the number of
 * files actually changed.
 *
 * We glob page files ourselves (not the DB) so this works even on a
 * stale index — `rename` and `delete` run the indexer AFTER mutation,
 * and we don't want the scan to miss a page that was just modified.
 */
export async function rewriteTopicOnPages(
  repoRoot: string,
  transform: (topics: string[]) => string[],
): Promise<number> {
  const pagesDir = join(repoRoot, ".almanac", "pages");
  const files = await fg("**/*.md", {
    cwd: pagesDir,
    absolute: true,
    onlyFiles: true,
  });
  let changed = 0;
  for (const filePath of files) {
    // Cheap read → in-memory check. Skip files that wouldn't be
    // changed so we don't bump their mtime.
    const raw = await readFile(filePath, "utf8");
    const applied = applyTopicsTransform(raw, transform);
    if (!applied.changed) continue;
    await rewritePageTopics(filePath, transform);
    changed += 1;
  }
  return changed;
}
