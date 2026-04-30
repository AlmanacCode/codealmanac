import { runIndexer, type IndexResult } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolve-wiki.js";

export interface ReindexOptions {
  cwd: string;
  wiki?: string;
}

export interface ReindexCommandOutput {
  result: IndexResult;
  stdout: string;
  exitCode: number;
}

/**
 * `almanac reindex` — force a full rebuild.
 *
 * Unlike the implicit reindex every query command triggers, this one
 * prints a summary line so the user gets feedback for an explicitly
 * requested action. The summary is terse on purpose (one line, three
 * numbers) — verbose progress reporting would fight the design rule that
 * the CLI stays quiet by default.
 */
export async function runReindex(
  options: ReindexOptions,
): Promise<ReindexCommandOutput> {
  const repoRoot = await resolveWikiRoot({
    cwd: options.cwd,
    wiki: options.wiki,
  });
  const result = await runIndexer({ repoRoot });
  // Summary wording: "reindexed: N pages (K updated, R removed)". When
  // some files were on disk but never made it into the index
  // (slug collisions, ENOENT races, un-sluggable filenames), tack on a
  // `; S skipped` suffix so the user notices. The per-file reason was
  // already written to stderr at indexing time.
  const skipSuffix =
    result.filesSkipped > 0 ? `; ${result.filesSkipped} skipped` : "";
  const stdout = `reindexed: ${result.pagesIndexed} page${result.pagesIndexed === 1 ? "" : "s"} (${result.changed} updated, ${result.removed} removed${skipSuffix})\n`;
  return { result, stdout, exitCode: 0 };
}
