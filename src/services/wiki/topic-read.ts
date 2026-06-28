import { toKebabCase } from "../../shared/slug.js";
import * as query from "../../stores/wiki/query/index.js";
import { topicTitleFromSlug } from "../../stores/wiki/topics/title.js";
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
    return query.topics
      .topicSummaries(db, { order: "slug" })
      .map(topicSummaryFromQuery);
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

    const pageSlugs = query.topics.topicPageSlugs(db, slug, {
      includeDescendants: request.descendants === true,
    });

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
    title: params.detail.title ?? topicTitleFromSlug(params.detail.slug),
    description: params.detail.description,
    parents: params.detail.parents.map((parent) => parent.slug),
    children: params.detail.children.map((child) => child.slug),
    pages: params.pages,
    descendants_used: params.descendantsUsed,
  };
}

function topicSummaryFromQuery(
  summary: query.topics.TopicSummary,
): WikiTopicSummary {
  return {
    slug: summary.slug,
    title: summary.title,
    description: summary.description,
    page_count: summary.page_count,
    parents: summary.parents,
  };
}
