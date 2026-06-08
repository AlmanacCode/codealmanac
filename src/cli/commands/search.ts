import { join } from "node:path";

import type Database from "better-sqlite3";

import { BLUE, RST } from "../../ansi.js";
import { parseDuration } from "../../wiki/indexer/duration.js";
import { ensureFreshIndex } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import { openIndex } from "../../wiki/indexer/schema.js";
import * as query from "../../wiki/query/index.js";

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
}

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
  summary: string | null;
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
  //
  // We deliberately avoid GLOB on the RHS of the comparison with stored
  // `r.path`, because stored paths can legitimately contain GLOB
  // metacharacters — Next.js dynamic routes like `src/[id]/page.tsx`
  // store a literal `[id]`, and `[abc]` is a SQL GLOB character class.
  // Concatenating `r.path || '*'` into a GLOB pattern would make
  // `src/[id]/page.tsx*` match `src/i/page.tsx` (spurious hit on the
  // character class).
  //
  // Instead we enumerate the prefix folders in JS and use parameterized
  // equality. For `src/checkout/handler.ts` the prefixes are
  // `['src/', 'src/checkout/']`; any file_refs row with is_dir=1 and
  // a path in that list is a containing folder of the queried file.
  // This also lets SQLite use `idx_file_refs_path` as an equality
  // probe rather than a range scan.
  if (options.mentions !== undefined && options.mentions.length > 0) {
    const mention = query.search.buildFileMentionFilter(options.mentions);
    if (mention.isDir) {
      // Query is a folder. Match: the exact folder, OR any file/sub-
      // folder whose path starts with the folder prefix. The prefix
      // match is the one place we still need GLOB — but we escape any
      // wildcard metacharacters in `norm` first so a user-supplied
      // `src/[id]/` query is treated as a literal. Note: the query
      // path comes from the caller, not from stored data, but a user
      // typing `--mentions src/[id]/` should get the literal folder,
      // not a character class.
      whereClauses.push(
        `EXISTS (
           SELECT 1 FROM file_refs r
           WHERE r.page_slug = p.slug
             AND (r.path = ? OR r.path GLOB ?)
         )`,
      );
      params.push(mention.normalizedPath, mention.globPrefix);
    } else {
      // Query is a file. Match: the exact file, OR any folder whose
      // path is a prefix of this file. Build the prefix list in JS and
      // probe file_refs with equality — no GLOB on stored values.
      if (mention.parentFolders.length === 0) {
        whereClauses.push(
          `EXISTS (
             SELECT 1 FROM file_refs r
             WHERE r.page_slug = p.slug AND r.path = ?
           )`,
        );
        params.push(mention.normalizedPath);
      } else {
        const placeholders = mention.parentFolders.map(() => "?").join(", ");
        whereClauses.push(
          `EXISTS (
             SELECT 1 FROM file_refs r
             WHERE r.page_slug = p.slug
               AND (
                 r.path = ?
                 OR (r.is_dir = 1 AND r.path IN (${placeholders}))
               )
           )`,
        );
        params.push(mention.normalizedPath, ...mention.parentFolders);
      }
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
    const ftsExpr = query.search.buildTokenPrefixFtsQuery(options.query);
    sql = `
      SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
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
    summary: row.summary,
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
    SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
    FROM pages p
    ${where}
    ORDER BY p.updated_at DESC, p.slug ASC
  `;
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
  const output = options.output ?? "slugs";
  if (output === "json") {
    return `${JSON.stringify(rows, null, 2)}\n`;
  }
  // Empty result = empty output (not "no results found") — makes piping
  // into xargs / subsequent commands degrade gracefully.
  if (rows.length === 0) return "";
  if (output === "slugs") {
    return `${rows.map((r) => `${BLUE}${r.slug}${RST}`).join("\n")}\n`;
  }
  return `${rows.map(formatSearchResult).join("\n")}\n`;
}

function formatSearchResult(row: SearchResult): string {
  const head = `${BLUE}${row.slug}${RST}`;
  if (row.summary === null || row.summary.trim().length === 0) return head;
  return `${head}\n  ${row.summary.trim()}`;
}

function buildStderr(rows: SearchResult[], options: SearchOptions): string {
  // Spec: "print warns if >50 when not --json". The warning goes to
  // stderr so it doesn't corrupt pipelines that filter stdout.
  if (options.output === "json") return "";
  // Empty-result breadcrumb (v0.1.3). Interviews showed users saw blank
  // stdout and concluded the wiki was broken rather than the query
  // genuinely matched nothing. A single `# 0 results` line to stderr
  // makes the outcome legible without corrupting stdout pipelines (the
  // downstream command still sees zero lines). `--json` mode is silent
  // because `[]` is the unambiguous empty signal there.
  if (rows.length === 0) {
    return "# 0 results\n";
  }
  if (options.limit !== undefined) return "";
  if (rows.length > 50) {
    return `almanac: ${rows.length} results — consider --limit or a narrower query\n`;
  }
  return "";
}
