import {
  reindexWiki,
  type ReindexWikiRequest,
  type ReindexWikiResult,
} from "../../services/wiki/reindex.js";
import {
  renderReindexResult,
  type ReindexCommandOutput,
} from "./reindex-render.js";

export type { ReindexCommandOutput } from "./reindex-render.js";

export interface ReindexOptions {
  cwd: string;
  wiki?: string;
}

export interface ReindexResult {
  changed: number;
  removed: number;
  total: number;
  pagesIndexed: number;
  filesSeen: number;
  filesSkipped: number;
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
  const result = reindexResultFromWikiService(
    await reindexWiki(toReindexWikiRequest(options)),
  );
  return renderReindexResult(result);
}

function toReindexWikiRequest(options: ReindexOptions): ReindexWikiRequest {
  return {
    cwd: options.cwd,
    wiki: options.wiki,
  };
}

function reindexResultFromWikiService(result: ReindexWikiResult): ReindexResult {
  return {
    changed: result.changed,
    removed: result.removed,
    total: result.total,
    pagesIndexed: result.pagesIndexed,
    filesSeen: result.filesSeen,
    filesSkipped: result.filesSkipped,
  };
}
