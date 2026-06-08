import type Database from "better-sqlite3";

import {
  buildFileMentionFilter,
  buildQuotedPrefixFtsQuery,
  buildQuotedTermFtsQuery,
} from "./search.js";

export interface PageSummary {
  slug: string;
  title: string | null;
  summary: string | null;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  topics: string[];
}

export function recentPages(
  db: Database.Database,
  limit = 12,
): PageSummary[] {
  return pageSummaries(
    db,
    `SELECT slug, title, summary, updated_at, archived_at, superseded_by
     FROM pages
     WHERE archived_at IS NULL
     ORDER BY updated_at DESC, slug ASC
     LIMIT ${limit}`,
    [],
  );
}

export function pageSummaryBySlug(
  db: Database.Database,
  slug: string,
): PageSummary | null {
  return pageSummaries(
    db,
    `SELECT slug, title, summary, updated_at, archived_at, superseded_by
     FROM pages
     WHERE archived_at IS NULL AND slug = ?
     LIMIT 1`,
    [slug],
  )[0] ?? null;
}

export function pagesBySlug(
  db: Database.Database,
  slugs: string[],
): PageSummary[] {
  if (slugs.length === 0) return [];
  const placeholders = Array.from({ length: slugs.length }, () => "?").join(", ");
  return pageSummaries(
    db,
    `SELECT slug, title, summary, updated_at, archived_at, superseded_by
     FROM pages
     WHERE slug IN (${placeholders})
     ORDER BY title COLLATE NOCASE, slug ASC`,
    slugs,
  );
}

export function searchPages(
  db: Database.Database,
  args: {
    query: string;
    limit: number;
    prefix?: boolean;
  },
): { query: string; pages: PageSummary[] } {
  const trimmed = args.query.trim();
  if (trimmed.length === 0) {
    return { query: trimmed, pages: recentPages(db, args.limit) };
  }
  const ftsQuery = args.prefix === true
    ? buildQuotedPrefixFtsQuery(trimmed)
    : buildQuotedTermFtsQuery(trimmed);
  if (ftsQuery.length === 0) return { query: trimmed, pages: [] };
  return {
    query: trimmed,
    pages: pageSummaries(
      db,
      `SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
       FROM pages p
       JOIN fts_pages f ON f.slug = p.slug
       WHERE p.archived_at IS NULL AND fts_pages MATCH ?
       ORDER BY f.rank ASC, p.updated_at DESC, p.slug ASC
       LIMIT ${args.limit}`,
      [ftsQuery],
    ),
  };
}

export function pagesMentioningPath(
  db: Database.Database,
  path: string,
  limit = 100,
): { path: string; pages: PageSummary[] } {
  const trimmed = path.trim();
  if (trimmed.length === 0) return { path: trimmed, pages: [] };
  return {
    path: trimmed,
    pages: pageSummaries(
      db,
      fileMentionSql(trimmed, limit),
      fileMentionParams(trimmed),
    ),
  };
}

export function pageSummaries(
  db: Database.Database,
  sql: string,
  params: Array<string | number>,
): PageSummary[] {
  const rows = db
    .prepare<unknown[], Omit<PageSummary, "topics">>(sql)
    .all(...params);
  const topicsStmt = db.prepare<[string], { topic_slug: string }>(
    "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
  );
  return rows.map((row) => ({
    ...row,
    topics: topicsStmt.all(row.slug).map((r) => r.topic_slug),
  }));
}

function fileMentionSql(input: string, limit: number): string {
  const mention = buildFileMentionFilter(input);
  if (mention.isDir) {
    return `SELECT DISTINCT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
            FROM pages p
            JOIN file_refs r ON r.page_slug = p.slug
            WHERE p.archived_at IS NULL AND (r.path = ? OR r.path GLOB ?)
            ORDER BY p.updated_at DESC, p.slug ASC
            LIMIT ${limit}`;
  }
  const placeholders = mention.parentFolders.map(() => "?").join(", ");
  const folderClause = mention.parentFolders.length > 0
    ? `OR (r.is_dir = 1 AND r.path IN (${placeholders}))`
    : "";
  return `SELECT DISTINCT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
          FROM pages p
          JOIN file_refs r ON r.page_slug = p.slug
          WHERE p.archived_at IS NULL AND (r.path = ? ${folderClause})
          ORDER BY p.updated_at DESC, p.slug ASC
          LIMIT ${limit}`;
}

function fileMentionParams(input: string): string[] {
  const mention = buildFileMentionFilter(input);
  if (mention.isDir) return [mention.normalizedPath, mention.globPrefix];
  return [mention.normalizedPath, ...mention.parentFolders];
}
