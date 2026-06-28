import {
  searchWikiPages,
  type WikiSearchResult,
  type SearchWikiPagesRequest,
} from "../../../services/wiki/search.js";
import {
  renderSearchResults,
  type SearchCommandOutput,
  type SearchOutputMode,
  type SearchResult,
} from "./search-render.js";

export interface SearchOptions {
  cwd: string;
  query?: string;
  topics: string[];
  mentions?: string;
  since?: string;
  stale?: string;
  orphan?: boolean;
  includeArchive?: boolean;
  archived?: boolean;
  wiki?: string;
  output?: SearchOutputMode;
  limit?: number;
  color?: boolean;
}

export type {
  SearchCommandOutput,
  SearchOutputMode,
  SearchResult,
} from "./search-render.js";

/**
 * `almanac search` — the core query surface.
 *
 * This command adapter delegates wiki lookup to the wiki service and
 * renders the selected CLI output shape.
 */
export async function runSearch(
  options: SearchOptions,
): Promise<SearchCommandOutput> {
  const rows = (
    await searchWikiPages(toSearchWikiPagesRequest(options))
  ).map(searchResultFromWikiService);
  const limited =
    options.limit !== undefined && options.limit >= 0
      ? rows.slice(0, options.limit)
      : rows;

  return renderSearchResults(limited, options);
}

function toSearchWikiPagesRequest(
  options: SearchOptions,
): SearchWikiPagesRequest {
  return {
    cwd: options.cwd,
    query: options.query,
    topics: options.topics,
    mentions: options.mentions,
    since: options.since,
    stale: options.stale,
    orphan: options.orphan,
    includeArchive: options.includeArchive,
    archived: options.archived,
    wiki: options.wiki,
  };
}

function searchResultFromWikiService(result: WikiSearchResult): SearchResult {
  return {
    slug: result.slug,
    title: result.title,
    summary: result.summary,
    updated_at: result.updated_at,
    archived_at: result.archived_at,
    superseded_by: result.superseded_by,
    topics: result.topics,
  };
}
