import type Database from "better-sqlite3";

import { toKebabCase } from "../../../shared/slug.js";
import { descendantsInDb } from "../topics/dag.js";
import { pageSummaries, type PageSummary } from "./pages.js";

export interface TopicSummary {
  slug: string;
  title: string | null;
  description: string | null;
  page_count: number;
  parents: string[];
}

export interface TopicDetail {
  slug: string;
  title: string | null;
  description: string | null;
  parents: Array<{ slug: string; title: string | null }>;
  children: Array<{ slug: string; title: string | null; page_count: number }>;
  pages: PageSummary[];
}

export function topicSummaries(
  db: Database.Database,
  options: {
    rootsOnly?: boolean;
    limit?: number;
    order?: "slug" | "page_count";
  } = {},
): TopicSummary[] {
  const rootJoin = options.rootsOnly === true
    ? "LEFT JOIN topic_parents parent ON parent.child_slug = t.slug"
    : "";
  const rootWhere = options.rootsOnly === true ? "WHERE parent.parent_slug IS NULL" : "";
  const limit = options.limit === undefined ? "" : `LIMIT ${options.limit}`;
  const order = options.order === "page_count"
    ? "page_count DESC, t.slug ASC"
    : "t.slug ASC";
  const rows = db
    .prepare<[], Omit<TopicSummary, "parents">>(
      `SELECT t.slug, t.title, t.description,
              (SELECT COUNT(*)
                 FROM page_topics pt
                 JOIN pages p ON p.slug = pt.page_slug
                 WHERE pt.topic_slug = t.slug AND p.archived_at IS NULL
              ) AS page_count
       FROM topics t
       ${rootJoin}
       ${rootWhere}
       GROUP BY t.slug, t.title, t.description
       ORDER BY ${order}
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

export function topicDetail(
  db: Database.Database,
  rawSlug: string,
): TopicDetail | null {
  const slug = toKebabCase(rawSlug);
  const row = db
    .prepare<[string], { slug: string; title: string | null; description: string | null }>(
      "SELECT slug, title, description FROM topics WHERE slug = ?",
    )
    .get(slug);
  if (row === undefined) return null;

  const parents = db
    .prepare<[string], { slug: string; title: string | null }>(
      `SELECT t.slug, t.title
       FROM topic_parents tp
       JOIN topics t ON t.slug = tp.parent_slug
       WHERE tp.child_slug = ?
       ORDER BY t.slug`,
    )
    .all(slug);

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
    .all(slug);

  const pages = pageSummaries(
    db,
    `SELECT p.slug, p.title, p.summary, p.updated_at, p.archived_at, p.superseded_by
     FROM pages p
     JOIN page_topics pt ON pt.page_slug = p.slug
     WHERE p.archived_at IS NULL AND pt.topic_slug = ?
     ORDER BY p.updated_at DESC, p.slug ASC
     LIMIT 100`,
    [slug],
  );

  return { ...row, parents, children, pages };
}

export function topicPageSlugs(
  db: Database.Database,
  rawSlug: string,
  options: { includeDescendants?: boolean } = {},
): string[] {
  const slug = toKebabCase(rawSlug);
  if (options.includeDescendants === true) {
    return pageSlugsForTopicSubtree(db, slug);
  }
  return pageSlugsForTopic(db, slug);
}

function pageSlugsForTopic(
  db: Database.Database,
  slug: string,
): string[] {
  return db
    .prepare<[string], { page_slug: string }>(
      `SELECT pt.page_slug
       FROM page_topics pt
       JOIN pages p ON p.slug = pt.page_slug
       WHERE pt.topic_slug = ? AND p.archived_at IS NULL
       ORDER BY pt.page_slug`,
    )
    .all(slug)
    .map((row) => row.page_slug);
}

function pageSlugsForTopicSubtree(
  db: Database.Database,
  slug: string,
): string[] {
  const slugs = [slug, ...descendantsInDb(db, slug)];
  const placeholders = slugs.map(() => "?").join(", ");
  const rows = db
    .prepare<unknown[], { page_slug: string }>(
      `SELECT DISTINCT pt.page_slug
       FROM page_topics pt
       JOIN pages p ON p.slug = pt.page_slug
       WHERE pt.topic_slug IN (${placeholders}) AND p.archived_at IS NULL
       ORDER BY pt.page_slug`,
    )
    .all(...slugs);
  return rows.map((row) => row.page_slug);
}
