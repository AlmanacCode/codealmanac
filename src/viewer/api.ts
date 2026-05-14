import { existsSync } from "node:fs";
import { join } from "node:path";

import type Database from "better-sqlite3";

import { ensureFreshIndex } from "../indexer/index.js";
import { looksLikeDir, normalizePath } from "../indexer/paths.js";
import { openIndex } from "../indexer/schema.js";
import { getPageView, type PageView } from "../query/page-view.js";
import { toKebabCase } from "../slug.js";
import { topicsYamlPath } from "../topics/paths.js";
import {
  getViewerJob,
  listViewerJobs,
  type ViewerJobDetail,
  type ViewerJobRun,
} from "./jobs.js";

const SIDEBAR_TAG_LIMIT = 8;

export interface ViewerApiContext {
  repoRoot: string;
}

export interface ViewerPageSummary {
  slug: string;
  title: string | null;
  summary: string | null;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  topics: string[];
}

export interface ViewerOverview {
  repoRoot: string;
  wikiTitle: string;
  pageCount: number;
  topicCount: number;
  recentPages: ViewerPageSummary[];
  topics: ViewerTopicSummary[];
  rootTopics: ViewerTopicSummary[];
  topicNavigation: {
    source: "curated" | "tags";
    sidebarLimit: number;
  };
  featuredPages: {
    projectOverview: ViewerPageSummary | null;
    gettingStarted: ViewerPageSummary | null;
  };
}

export interface ViewerTopicSummary {
  slug: string;
  title: string | null;
  description: string | null;
  page_count: number;
  parents: string[];
}

export interface ViewerTopic {
  slug: string;
  title: string | null;
  description: string | null;
  parents: Array<{ slug: string; title: string | null }>;
  children: Array<{ slug: string; title: string | null; page_count: number }>;
  pages: ViewerPageSummary[];
}

export interface ViewerApi {
  overview(): Promise<ViewerOverview>;
  page(slug: string): Promise<PageView | null>;
  topic(slug: string): Promise<ViewerTopic | null>;
  search(query: string): Promise<{ query: string; pages: ViewerPageSummary[] }>;
  suggest(query: string): Promise<{ query: string; pages: ViewerPageSummary[] }>;
  file(path: string): Promise<{ path: string; pages: ViewerPageSummary[] }>;
  jobs(): Promise<{ runs: ViewerJobRun[] }>;
  job(runId: string): Promise<ViewerJobDetail | null>;
}

export function createViewerApi(ctx: ViewerApiContext): ViewerApi {
  return {
    async overview() {
      return withFreshDb(ctx.repoRoot, (db) => {
        const topicNavigation = {
          source: existsSync(topicsYamlPath(ctx.repoRoot)) ? "curated" as const : "tags" as const,
          sidebarLimit: SIDEBAR_TAG_LIMIT,
        };
        const counts = db
          .prepare<[], { page_count: number; topic_count: number }>(
            `SELECT
               (SELECT COUNT(*) FROM pages WHERE archived_at IS NULL) AS page_count,
               (SELECT COUNT(*) FROM topics) AS topic_count`,
          )
          .get() ?? { page_count: 0, topic_count: 0 };

        return {
          repoRoot: ctx.repoRoot,
          wikiTitle: "Almanac",
          pageCount: counts.page_count,
          topicCount: counts.topic_count,
          recentPages: pageSummaries(db, recentPagesSql(60), []),
          topics: topicSummaries(db, { rootsOnly: false }),
          rootTopics: topicSummaries(db, {
            rootsOnly: true,
            limit: topicNavigation.source === "curated" ? 24 : topicNavigation.sidebarLimit,
          }),
          topicNavigation,
          featuredPages: {
            projectOverview: pageSummaryBySlug(db, "project-overview"),
            gettingStarted: pageSummaryBySlug(db, "getting-started"),
          },
        };
      });
    },

    async page(slug) {
      return withFreshDb(ctx.repoRoot, async (db) => {
        const page = await getPageView(db, toKebabCase(slug));
        if (page === null) return null;
        const relatedSlugs = Array.from(new Set([
          ...page.wikilinks_in,
          ...page.wikilinks_out,
          ...page.supersedes,
          ...(page.superseded_by !== null ? [page.superseded_by] : []),
        ]));
        const related_pages = relatedSlugs.length > 0
          ? pageSummaries(db, pagesBySlugSql(relatedSlugs.length), relatedSlugs)
          : [];
        return { ...page, related_pages };
      });
    },

    async topic(slug) {
      return withFreshDb(ctx.repoRoot, (db) => {
        const topicSlug = toKebabCase(slug);
        const row = db
          .prepare<[string], { slug: string; title: string | null; description: string | null }>(
            "SELECT slug, title, description FROM topics WHERE slug = ?",
          )
          .get(topicSlug);
        if (row === undefined) return null;

        const parents = db
          .prepare<[string], { slug: string; title: string | null }>(
            `SELECT t.slug, t.title
             FROM topic_parents tp
             JOIN topics t ON t.slug = tp.parent_slug
             WHERE tp.child_slug = ?
             ORDER BY t.slug`,
          )
          .all(topicSlug);

        const children = db
          .prepare<[string], { slug: string; title: string | null; page_count: number }>(
            `SELECT t.slug, t.title, COUNT(p.slug) AS page_count
             FROM topic_parents tp
             JOIN topics t ON t.slug = tp.child_slug
             LEFT JOIN page_topics pt ON pt.topic_slug = t.slug
             LEFT JOIN pages p ON p.slug = pt.page_slug AND p.archived_at IS NULL
             WHERE tp.parent_slug = ?
             GROUP BY t.slug, t.title
             ORDER BY t.slug`,
          )
          .all(topicSlug);

        const pages = pageSummaries(
          db,
          `SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
           FROM pages p
           JOIN page_topics pt ON pt.page_slug = p.slug
           WHERE p.archived_at IS NULL AND pt.topic_slug = ?
           ORDER BY p.updated_at DESC, p.slug ASC
           LIMIT 100`,
          [topicSlug],
        );

        return { ...row, parents, children, pages };
      });
    },

    async search(query) {
      return withFreshDb(ctx.repoRoot, (db) => {
        const trimmed = query.trim();
        const ftsQuery = trimmed.length > 0 ? buildFtsQuery(trimmed) : "";
        if (trimmed.length > 0 && ftsQuery.length === 0) return { query: trimmed, pages: [] };
        const sql = trimmed.length > 0 ? pageSearchSql(50) : recentPagesSql(50);
        const params = trimmed.length > 0 ? [ftsQuery] : [];
        return { query: trimmed, pages: pageSummaries(db, sql, params) };
      });
    },

    async suggest(query) {
      return withFreshDb(ctx.repoRoot, (db) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return { query: trimmed, pages: [] };
        const ftsQuery = buildFtsQuery(trimmed);
        if (ftsQuery.length === 0) return { query: trimmed, pages: [] };
        return {
          query: trimmed,
          pages: pageSummaries(db, pageSearchSql(8), [buildFtsPrefixQuery(trimmed)]),
        };
      });
    },

    async file(path) {
      return withFreshDb(ctx.repoRoot, (db) => {
        const trimmed = path.trim();
        const pages = trimmed.length === 0
          ? []
          : pageSummaries(db, fileMentionSql(trimmed), fileMentionParams(trimmed));
        return { path: trimmed, pages };
      });
    },

    async jobs() {
      return listViewerJobs(ctx.repoRoot);
    },

    async job(runId) {
      return getViewerJob(ctx.repoRoot, runId);
    },
  };
}

async function withFreshDb<T>(
  repoRoot: string,
  fn: (db: Database.Database) => T | Promise<T>,
): Promise<T> {
  await ensureFreshIndex({ repoRoot });
  const db = openIndex(join(repoRoot, ".almanac", "index.db"));
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

function recentPagesSql(limit = 12): string {
  return `SELECT slug, title, summary, updated_at, archived_at, superseded_by
          FROM pages
          WHERE archived_at IS NULL
          ORDER BY updated_at DESC, slug ASC
          LIMIT ${limit}`;
}

function pagesBySlugSql(count: number): string {
  const placeholders = Array.from({ length: count }, () => "?").join(", ");
  return `SELECT slug, title, summary, updated_at, archived_at, superseded_by
          FROM pages
          WHERE slug IN (${placeholders})
          ORDER BY title COLLATE NOCASE, slug ASC`;
}

function pageSearchSql(limit: number): string {
  return `SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
          FROM pages p
          JOIN fts_pages f ON f.slug = p.slug
          WHERE p.archived_at IS NULL AND fts_pages MATCH ?
          ORDER BY f.rank ASC, p.updated_at DESC, p.slug ASC
          LIMIT ${limit}`;
}

function pageSummaries(
  db: Database.Database,
  sql: string,
  params: Array<string | number>,
): ViewerPageSummary[] {
  const rows = db
    .prepare<unknown[], Omit<ViewerPageSummary, "topics">>(sql)
    .all(...params);
  const topicsStmt = db.prepare<[string], { topic_slug: string }>(
    "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
  );
  return rows.map((row) => ({
    ...row,
    topics: topicsStmt.all(row.slug).map((r) => r.topic_slug),
  }));
}

function pageSummaryBySlug(db: Database.Database, slug: string): ViewerPageSummary | null {
  return pageSummaries(
    db,
    `SELECT slug, title, summary, updated_at, archived_at, superseded_by
     FROM pages
     WHERE archived_at IS NULL AND slug = ?
     LIMIT 1`,
    [slug],
  )[0] ?? null;
}

function topicSummaries(
  db: Database.Database,
  options: { rootsOnly: boolean; limit?: number },
): ViewerTopicSummary[] {
  const rootJoin = options.rootsOnly
    ? "LEFT JOIN topic_parents parent ON parent.child_slug = t.slug"
    : "";
  const rootWhere = options.rootsOnly ? "WHERE parent.parent_slug IS NULL" : "";
  const limit = options.limit === undefined ? "" : `LIMIT ${options.limit}`;
  const rows = db
    .prepare<[], Omit<ViewerTopicSummary, "parents">>(
      `SELECT t.slug, t.title, t.description, COUNT(p.slug) AS page_count
       FROM topics t
       ${rootJoin}
       LEFT JOIN page_topics pt ON pt.topic_slug = t.slug
       LEFT JOIN pages p ON p.slug = pt.page_slug AND p.archived_at IS NULL
       ${rootWhere}
       GROUP BY t.slug, t.title, t.description
       ORDER BY page_count DESC, t.slug ASC
       ${limit}`,
    )
    .all();
  const parentsStmt = db.prepare<[string], { parent_slug: string }>(
    "SELECT parent_slug FROM topic_parents WHERE child_slug = ? ORDER BY parent_slug ASC",
  );
  return rows.map((topic) => ({
    ...topic,
    page_count: Number(topic.page_count),
    parents: parentsStmt.all(topic.slug).map((row) => row.parent_slug),
  }));
}

function buildFtsQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/"/g, ""))
    .filter((term) => term.length > 0)
    .map((term) => `"${term}"`)
    .join(" AND ");
}

function buildFtsPrefixQuery(input: string): string {
  return input
    .split(/\s+/)
    .map((term) => term.replace(/["*]/g, ""))
    .filter((term) => term.length > 0)
    .map((term) => `"${term}"*`)
    .join(" AND ");
}

function fileMentionSql(input: string): string {
  const isDir = looksLikeDir(input);
  if (isDir) {
    return `SELECT DISTINCT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
            FROM pages p
            JOIN file_refs r ON r.page_slug = p.slug
            WHERE p.archived_at IS NULL AND (r.path = ? OR r.path GLOB ?)
            ORDER BY p.updated_at DESC, p.slug ASC
            LIMIT 100`;
  }
  const prefixes = parentFolderPrefixes(normalizePath(input, false));
  const placeholders = prefixes.map(() => "?").join(", ");
  const folderClause = prefixes.length > 0
    ? `OR (r.is_dir = 1 AND r.path IN (${placeholders}))`
    : "";
  return `SELECT DISTINCT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
          FROM pages p
          JOIN file_refs r ON r.page_slug = p.slug
          WHERE p.archived_at IS NULL AND (r.path = ? ${folderClause})
          ORDER BY p.updated_at DESC, p.slug ASC
          LIMIT 100`;
}

function fileMentionParams(input: string): string[] {
  const isDir = looksLikeDir(input);
  const norm = normalizePath(input, isDir);
  if (isDir) return [norm, `${escapeGlobMeta(norm)}*`];
  return [norm, ...parentFolderPrefixes(norm)];
}

function parentFolderPrefixes(path: string): string[] {
  const parts = path.split("/");
  if (parts.length <= 1) return [];
  const prefixes: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    prefixes.push(`${parts.slice(0, i).join("/")}/`);
  }
  return prefixes;
}

function escapeGlobMeta(input: string): string {
  return input.replace(/([*?\[])/g, "[$1]");
}
