import type Database from "better-sqlite3";
import { join } from "node:path";

import { toKebabCase } from "../../slug.js";
import { ensureFreshIndex, runIndexer } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import { openIndex } from "../../wiki/indexer/schema.js";
import * as query from "../../wiki/query/index.js";
import { descendantsInDb } from "../../wiki/topics/dag.js";
import { topicsYamlPath } from "../../wiki/topics/paths.js";
import {
  ensureTopic,
  findTopic,
  loadTopicsFile,
  writeTopicsFile,
} from "../../wiki/topics/yaml.js";

export type WikiTopicSummary = query.topics.TopicSummary;

export interface WikiTopicsRequest {
  cwd: string;
  wiki?: string;
}

export interface WikiTopicRequest extends WikiTopicsRequest {
  slug: string;
  descendants?: boolean;
}

export interface DescribeWikiTopicRequest extends WikiTopicsRequest {
  slug: string;
  description: string;
}

export interface UnlinkWikiTopicsRequest extends WikiTopicsRequest {
  child: string;
  parent: string;
}

export interface WikiTopicRecord {
  slug: string;
  title: string | null;
  description: string | null;
  parents: string[];
  children: string[];
  pages: string[];
  descendants_used?: boolean;
}

export type WikiTopicResult =
  | { status: "found"; topic: WikiTopicRecord }
  | { status: "empty-slug" }
  | { status: "missing"; slug: string };

export type DescribeWikiTopicResult =
  | { status: "described"; slug: string }
  | { status: "empty-slug" }
  | { status: "missing"; slug: string };

export type UnlinkWikiTopicsResult =
  | { status: "unlinked"; child: string; parent: string }
  | { status: "no-edge"; child: string; parent: string }
  | { status: "empty-slug" };

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
      topic: {
        slug: detail.slug,
        title: detail.title,
        description: detail.description,
        parents: detail.parents.map((parent) => parent.slug),
        children: detail.children.map((child) => child.slug),
        pages: pageSlugs,
        descendants_used: request.descendants === true,
      },
    };
  } finally {
    db.close();
  }
}

export async function describeWikiTopic(
  request: DescribeWikiTopicRequest,
): Promise<DescribeWikiTopicResult> {
  const slug = toKebabCase(request.slug);
  if (slug.length === 0) return { status: "empty-slug" };

  const { repoRoot, db } = await openFreshTopicIndex(request);
  try {
    const detail = query.topics.topicDetail(db, slug);
    if (detail === null) return { status: "missing", slug };

    const yamlPath = topicsYamlPath(repoRoot);
    const file = await loadTopicsFile(yamlPath);
    const entry = ensureTopic(file, slug);
    const text = request.description.trim();
    entry.description = text.length === 0 ? null : text;

    await writeTopicsFile(yamlPath, file);
  } finally {
    db.close();
  }

  await runIndexer({ repoRoot });
  return { status: "described", slug };
}

export async function unlinkWikiTopics(
  request: UnlinkWikiTopicsRequest,
): Promise<UnlinkWikiTopicsResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const child = toKebabCase(request.child);
  const parent = toKebabCase(request.parent);
  if (child.length === 0 || parent.length === 0) {
    return { status: "empty-slug" };
  }

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const childEntry = findTopic(file, child);
  if (childEntry === null || !childEntry.parents.includes(parent)) {
    return { status: "no-edge", child, parent };
  }

  childEntry.parents = childEntry.parents.filter((p) => p !== parent);
  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return { status: "unlinked", child, parent };
}

async function openFreshTopicIndex(
  request: WikiTopicsRequest,
): Promise<{ repoRoot: string; db: Database.Database }> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  await ensureFreshIndex({ repoRoot });
  return { repoRoot, db: openIndex(join(repoRoot, ".almanac", "index.db")) };
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
