import type Database from "better-sqlite3";

import { toKebabCase } from "../../slug.js";
import * as query from "../../wiki/query/index.js";
import { descendantsInDb } from "../../wiki/topics/dag.js";
import type {
  WikiTopicRecord,
  WikiTopicRequest,
  WikiTopicResult,
  WikiTopicSummary,
  WikiTopicsRequest,
} from "./topic-types.js";
import { openFreshTopicIndex } from "./topic-workspace.js";

export async function listWikiTopics(
  request: WikiTopicsRequest,
): Promise<WikiTopicSummary[]> {
  const { db } = await openFreshTopicIndex(request);
  try {
    return query.topics.topicSummaries(db, { order: "slug" });
  } finally {
    db.close();
  }
}

export async function readWikiTopic(
  request: WikiTopicRequest,
): Promise<WikiTopicResult> {
  const slug = toKebabCase(request.slug);
  if (slug.length === 0) return { status: "empty-slug" };

  const { db } = await openFreshTopicIndex(request);
  try {
    const detail = query.topics.topicDetail(db, slug);
    if (detail === null) return { status: "missing", slug };

    const pageSlugs = request.descendants === true
      ? pagesForTopicSubtree(db, slug)
      : pagesDirectlyTaggedWithTopic(db, slug);

    return {
      status: "found",
      topic: topicRecordFromDetail({
        detail,
        pages: pageSlugs,
        descendantsUsed: request.descendants === true,
      }),
    };
  } finally {
    db.close();
  }
}

function topicRecordFromDetail(params: {
  detail: query.topics.TopicDetail;
  pages: string[];
  descendantsUsed: boolean;
}): WikiTopicRecord {
  return {
    slug: params.detail.slug,
    title: params.detail.title,
    description: params.detail.description,
    parents: params.detail.parents.map((parent) => parent.slug),
    children: params.detail.children.map((child) => child.slug),
    pages: params.pages,
    descendants_used: params.descendantsUsed,
  };
}

function pagesDirectlyTaggedWithTopic(
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
    .map((r) => r.page_slug);
}

function pagesForTopicSubtree(
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
  return rows.map((r) => r.page_slug);
}
