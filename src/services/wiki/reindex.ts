import { runIndexer, type IndexResult } from "../../stores/wiki/indexer/index.js";
import { resolveWikiRoot } from "../../stores/wiki/indexer/resolve-wiki.js";

export type ReindexWikiWarningSink = (message: string) => void;

export interface ReindexWikiRequest {
  cwd: string;
  wiki?: string;
  warnings?: ReindexWikiWarningSink;
}

export interface ReindexWikiResult {
  changed: number;
  removed: number;
  pagesIndexed: number;
  filesSeen: number;
  filesSkipped: number;
}

export async function reindexWiki(
  request: ReindexWikiRequest,
): Promise<ReindexWikiResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  return reindexResultFromIndexer(
    await runIndexer({
      repoRoot,
      warnings: request.warnings,
    }),
  );
}

function reindexResultFromIndexer(result: IndexResult): ReindexWikiResult {
  return {
    changed: result.changed,
    removed: result.removed,
    pagesIndexed: result.pagesIndexed,
    filesSeen: result.filesSeen,
    filesSkipped: result.filesSkipped,
  };
}
