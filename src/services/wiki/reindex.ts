import { runIndexer, type IndexResult } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";

export interface ReindexWikiRequest {
  cwd: string;
  wiki?: string;
}

export interface ReindexWikiResult {
  changed: number;
  removed: number;
  total: number;
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
  return reindexResultFromIndexer(await runIndexer({ repoRoot }));
}

function reindexResultFromIndexer(result: IndexResult): ReindexWikiResult {
  return {
    changed: result.changed,
    removed: result.removed,
    total: result.total,
    pagesIndexed: result.pagesIndexed,
    filesSeen: result.filesSeen,
    filesSkipped: result.filesSkipped,
  };
}
