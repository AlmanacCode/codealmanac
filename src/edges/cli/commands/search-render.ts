import { makeAnsiTheme, type AnsiTheme } from "../../../shared/ansi-theme.js";

export type SearchOutputMode = "slugs" | "summaries" | "json";

export interface SearchResult {
  slug: string;
  title: string | null;
  summary: string | null;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  topics: string[];
}

export interface SearchRenderOptions {
  output?: SearchOutputMode;
  limit?: number;
  color?: boolean;
}

export interface SearchCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderSearchResults(
  rows: SearchResult[],
  options: SearchRenderOptions,
): SearchCommandOutput {
  return {
    stdout: formatResults(rows, options),
    stderr: buildStderr(rows, options),
    exitCode: 0,
  };
}

function formatResults(
  rows: SearchResult[],
  options: SearchRenderOptions,
): string {
  const output = options.output ?? "slugs";
  if (output === "json") {
    return `${JSON.stringify(rows, null, 2)}\n`;
  }

  // Empty result = empty output so pipelines receive zero rows.
  if (rows.length === 0) return "";

  const theme = makeAnsiTheme(options.color === true);

  if (output === "slugs") {
    return `${rows.map((row) => formatSlug(row, theme)).join("\n")}\n`;
  }

  return `${rows.map((row) => formatSearchResult(row, theme)).join("\n")}\n`;
}

function formatSearchResult(row: SearchResult, theme: AnsiTheme): string {
  const head = formatSlug(row, theme);
  if (row.summary === null || row.summary.trim().length === 0) return head;
  return `${head}\n  ${row.summary.trim()}`;
}

function formatSlug(row: SearchResult, theme: AnsiTheme): string {
  const { BLUE, RST } = theme;
  return `${BLUE}${row.slug}${RST}`;
}

function buildStderr(
  rows: SearchResult[],
  options: SearchRenderOptions,
): string {
  if (options.output === "json") return "";

  // Empty-result breadcrumb keeps blank stdout legible without breaking
  // downstream commands that consume stdout line-by-line.
  if (rows.length === 0) return "# 0 results\n";

  if (options.limit !== undefined) return "";

  if (rows.length > 50) {
    return `almanac: ${rows.length} results — consider --limit or a narrower query\n`;
  }

  return "";
}
