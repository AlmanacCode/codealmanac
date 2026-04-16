import { join } from "node:path";

import type Database from "better-sqlite3";

import { parseDuration } from "../indexer/duration.js";
import { ensureFreshIndex } from "../indexer/index.js";
import { looksLikeDir, normalizePath } from "../indexer/paths.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";

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
  json?: boolean;
  limit?: number;
}

export interface SearchResult {
  slug: string;
  title: string | null;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  topics: string[];
}

export interface SearchCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * `almanac search` — the core query surface.
 *
 * Filters compose with AND logic. The implementation is deliberately
 * pedestrian: build a list of clauses + params, join them with `AND`,
 * intersect topic filters by requiring one subquery per `--topic`. No
 * clever query-planner tricks needed for the sizes we handle (<10k pages).
 *
 * All output ordering is stable: `updated_at DESC, slug ASC`. FTS5 rank
 * is layered on top when the user passed a text query — we ORDER BY rank
 * first, then fall through to the default.
 */
export async function runSearch(
  options: SearchOptions,
): Promise<SearchCommandOutput> {
  const repoRoot = await resolveWikiRoot({
    cwd: options.cwd,
    wiki: options.wiki,
  });
  await ensureFreshIndex({ repoRoot });

  const dbPath = join(repoRoot, ".almanac", "index.db");
  const db = openIndex(dbPath);

  try {
    const rows = executeQuery(db, options);
    const limited =
      options.limit !== undefined && options.limit >= 0
        ? rows.slice(0, options.limit)
        : rows;

    const stdout = formatResults(limited, options);
    const stderr = buildStderr(limited, options);
    return { stdout, stderr, exitCode: 0 };
  } finally {
    db.close();
  }
}

interface PageRow {
  slug: string;
  title: string | null;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
}

function executeQuery(
  db: Database.Database,
  options: SearchOptions,
): SearchResult[] {
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  // Archive scope. Three modes, mutually exclusive in practice:
  //   - default            → active only
  //   - --include-archive  → active + archived
  //   - --archived         → archived only
  // `--archived` wins over `--include-archive` when both are passed —
  // being explicit about "only archived" is strictly narrower than
  // "include archived", so intersecting them yields "only archived".
  if (options.archived === true) {
    whereClauses.push("p.archived_at IS NOT NULL");
  } else if (options.includeArchive !== true) {
    whereClauses.push("p.archived_at IS NULL");
  }

  // --topic foo --topic bar → page must have BOTH. We add one EXISTS
  // subquery per topic rather than grouping, which keeps param order
  // simple and the plan readable.
  for (const rawTopic of options.topics) {
    const topicSlug = slugForTopic(rawTopic);
    if (topicSlug.length === 0) continue;
    whereClauses.push(
      "EXISTS (SELECT 1 FROM page_topics pt WHERE pt.page_slug = p.slug AND pt.topic_slug = ?)",
    );
    params.push(topicSlug);
  }

  // --mentions: look for a file_refs row on this page that either
  // matches exactly, OR is a containing folder (is_dir=1 and the query
  // path starts with the row's path), OR the row itself lives inside
  // the queried folder. See spec → "Graph querying → Query examples".
  if (options.mentions !== undefined && options.mentions.length > 0) {
    const isDir = looksLikeDir(options.mentions);
    const norm = normalizePath(options.mentions, isDir);
    if (isDir) {
      // Query is a folder. Match: the exact folder, OR any path (file
      // or sub-folder) inside it.
      whereClauses.push(
        `EXISTS (
           SELECT 1 FROM file_refs r
           WHERE r.page_slug = p.slug
             AND (r.path = ? OR r.path GLOB ? || '*')
         )`,
      );
      params.push(norm, norm);
    } else {
      // Query is a file. Match: the exact file, OR any folder whose
      // path is a prefix of this file. GLOB is critical here — LIKE
      // would treat `_` as a wildcard and spuriously match neighbors.
      whereClauses.push(
        `EXISTS (
           SELECT 1 FROM file_refs r
           WHERE r.page_slug = p.slug
             AND (
               r.path = ?
               OR (r.is_dir = 1 AND ? GLOB r.path || '*')
             )
         )`,
      );
      params.push(norm, norm);
    }
  }

  const now = Math.floor(Date.now() / 1000);

  if (options.since !== undefined) {
    const seconds = parseDuration(options.since);
    whereClauses.push("p.updated_at >= ?");
    params.push(now - seconds);
  }

  if (options.stale !== undefined) {
    const seconds = parseDuration(options.stale);
    whereClauses.push("p.updated_at < ?");
    params.push(now - seconds);
  }

  if (options.orphan === true) {
    whereClauses.push(
      "NOT EXISTS (SELECT 1 FROM page_topics pt WHERE pt.page_slug = p.slug)",
    );
  }

  // FTS5 text query. When a text query is supplied we JOIN against
  // `fts_pages` so we can ORDER BY its `rank` column — lower (more
  // negative) ranks are better matches. Without a query we skip the
  // join entirely.
  let sql: string;
  if (options.query !== undefined && options.query.trim().length > 0) {
    const ftsExpr = buildFtsQuery(options.query);
    sql = `
      SELECT p.slug, p.title, p.updated_at, p.archived_at, p.superseded_by
      FROM pages p
      JOIN fts_pages f ON f.slug = p.slug
      WHERE fts_pages MATCH ?
        ${whereClauses.length > 0 ? `AND ${whereClauses.join(" AND ")}` : ""}
      ORDER BY f.rank ASC, p.updated_at DESC, p.slug ASC
    `;
    // MATCH param goes first (it's the first `?` in the compiled SQL).
    params.unshift(ftsExpr);
  } else {
    sql = buildSql(whereClauses);
  }

  const rows = db.prepare<unknown[], PageRow>(sql).all(...params);

  // Attach topics in a second pass — simpler than a correlated
  // `GROUP_CONCAT`, and the output rows are small enough that N+1 on a
  // single prepared statement is fine.
  const topicStmt = db.prepare<[string], { topic_slug: string }>(
    "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
  );
  const out: SearchResult[] = rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
    superseded_by: row.superseded_by,
    topics: topicStmt.all(row.slug).map((t) => t.topic_slug),
  }));

  return out;
}

function buildSql(whereClauses: string[]): string {
  const where =
    whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  return `
    SELECT p.slug, p.title, p.updated_at, p.archived_at, p.superseded_by
    FROM pages p
    ${where}
    ORDER BY p.updated_at DESC, p.slug ASC
  `;
}

/**
 * Turn a user query into an FTS5 MATCH expression. FTS5's default
 * grammar gets unhappy with punctuation (hyphens, colons, slashes), so
 * we tokenize into alphanumeric runs and emit a conjunction of prefixed
 * tokens. Each token is suffixed with `*` so "stri" matches "stripe".
 *
 * Anything that tokenizes to empty (e.g. pure punctuation) falls back
 * to an empty MATCH, which yields no rows — which is the right answer.
 */
function buildFtsQuery(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return "\"\"";
  return tokens.map((t) => `${t}*`).join(" AND ");
}

function slugForTopic(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatResults(
  rows: SearchResult[],
  options: SearchOptions,
): string {
  if (options.json === true) {
    return `${JSON.stringify(rows, null, 2)}\n`;
  }
  // Default output: one slug per line. Empty result = empty output (not
  // "no results found") — makes piping into xargs / subsequent commands
  // degrade gracefully.
  if (rows.length === 0) return "";
  return `${rows.map((r) => r.slug).join("\n")}\n`;
}

function buildStderr(rows: SearchResult[], options: SearchOptions): string {
  // Spec: "print warns if >50 when not --json". The warning goes to
  // stderr so it doesn't corrupt pipelines that filter stdout.
  if (options.json === true) return "";
  if (options.limit !== undefined) return "";
  if (rows.length > 50) {
    return `almanac: ${rows.length} results — consider --limit or a narrower query\n`;
  }
  return "";
}
