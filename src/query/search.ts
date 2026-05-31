import { looksLikeDir, normalizePath } from "../indexer/paths.js";

export interface FileMentionFilter {
  isDir: boolean;
  normalizedPath: string;
  globPrefix: string;
  parentFolders: string[];
}

/**
 * CLI text search: tokenize into alphanumeric runs and use FTS5 prefix tokens.
 */
export function buildTokenPrefixFtsQuery(raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    trimmed.startsWith("\"") &&
    trimmed.endsWith("\"")
  ) {
    const inner = trimmed
      .slice(1, -1)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (inner.length === 0) return "\"\"";
    return `"${inner}"`;
  }
  const tokens = trimmed
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "\"\"";
  return tokens.map((t) => `${t}*`).join(" AND ");
}

/**
 * Viewer submitted search: quote whitespace terms for complete-query matching.
 */
export function buildQuotedTermFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/"/g, ""))
    .filter((term) => term.length > 0)
    .map((term) => `"${term}"`)
    .join(" AND ");
}

/**
 * Viewer suggestions: quote terms but allow FTS5 prefix matching while typing.
 */
export function buildQuotedPrefixFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, ""))
    .filter((term) => term.length > 0)
    .map((term) => `"${term}"*`)
    .join(" AND ");
}

export function buildFileMentionFilter(input: string): FileMentionFilter {
  const isDir = looksLikeDir(input);
  const normalizedPath = normalizePath(input, isDir);
  return {
    isDir,
    normalizedPath,
    globPrefix: `${escapeGlobMeta(normalizedPath)}*`,
    parentFolders: isDir ? [] : parentFolderPrefixes(normalizedPath),
  };
}

/**
 * For a normalized file path like `src/checkout/handler.ts`, enumerate
 * every containing folder in stored form: `['src/', 'src/checkout/']`.
 */
export function parentFolderPrefixes(filePath: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  while (true) {
    const next = filePath.indexOf("/", cursor);
    if (next === -1) break;
    out.push(filePath.slice(0, next + 1));
    cursor = next + 1;
  }
  return out;
}

export function escapeGlobMeta(input: string): string {
  return input.replace(/[\*\?\[]/g, (ch) => `[${ch}]`);
}
