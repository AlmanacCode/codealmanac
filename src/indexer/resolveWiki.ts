import { existsSync } from "node:fs";
import { join } from "node:path";

import { findNearestAlmanacDir } from "../paths.js";
import { findEntry } from "../registry/index.js";

/**
 * Figure out which repo root a query command should run against.
 *
 * Two modes, in order of precedence:
 *   1. `--wiki <name>`  — look it up in the global registry. Fails
 *      explicitly if the name isn't registered or its path has gone
 *      missing (unmounted drive, deleted repo). No silent fallback, which
 *      would hide the real problem from the user.
 *   2. default — walk up from `cwd` like git does. Fails if we're not
 *      inside a `.almanac/` repo.
 *
 * Returns the absolute path to the repo root (the directory containing
 * `.almanac/`).
 *
 * NOTE (spec contract, not yet implemented): when `--all` lands in a
 * future slice, it must silently skip wikis whose paths have gone
 * unreachable — the asymmetry with `--wiki <name>` is deliberate.
 * Explicit lookup is loud about failures (user named a specific wiki);
 * bulk `--all` is quiet (user asked "whatever's available"). Don't
 * unify the error behavior when adding `--all`.
 */
export async function resolveWikiRoot(params: {
  cwd: string;
  wiki?: string;
}): Promise<string> {
  if (params.wiki !== undefined) {
    const entry = await findEntry({ name: params.wiki });
    if (entry === null) {
      throw new Error(`no registered wiki named "${params.wiki}"`);
    }
    if (!existsSync(join(entry.path, ".almanac"))) {
      throw new Error(
        `wiki "${params.wiki}" path is unreachable (${entry.path})`,
      );
    }
    return entry.path;
  }

  const nearest = findNearestAlmanacDir(params.cwd);
  if (nearest === null) {
    throw new Error(
      "no .almanac/ found in this directory or any parent; run `almanac init` first",
    );
  }
  return nearest;
}
