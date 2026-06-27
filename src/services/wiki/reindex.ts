import { runIndexer, type IndexResult } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";

export interface ReindexWikiRequest {
  cwd: string;
  wiki?: string;
}

export type ReindexWikiResult = IndexResult;

export async function reindexWiki(
  request: ReindexWikiRequest,
): Promise<ReindexWikiResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  return runIndexer({ repoRoot });
}
