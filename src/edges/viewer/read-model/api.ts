import { existsSync } from "node:fs";
import { join } from "node:path";

import type Database from "better-sqlite3";

import { toKebabCase } from "../../../slug.js";
import { ensureFreshIndex } from "../../../stores/wiki/indexer/index.js";
import { openIndex } from "../../../stores/wiki/indexer/schema.js";
import * as wikiQuery from "../../../stores/wiki/query/index.js";
import { topicsYamlPath } from "../../../stores/wiki/topics/paths.js";
import {
  getViewerJobDetail,
  getViewerJobs,
  type ViewerJobDetail,
  type ViewerJobRun,
  type ViewerJobsRuntime,
} from "./jobs-api.js";
import { getViewerReview, type ViewerReview } from "./review-api.js";

const SIDEBAR_TAG_LIMIT = 8;

export interface ViewerApiContext {
  repoRoot: string;
  runtime: ViewerJobsRuntime;
}

export type ViewerPageSummary = wikiQuery.PageSummary;

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
    gettingStarted: ViewerPageSummary | null;
  };
}

export type ViewerTopicSummary = wikiQuery.TopicSummary;
export type ViewerTopic = wikiQuery.TopicDetail;

export interface ViewerApi {
  overview(): Promise<ViewerOverview>;
  page(slug: string): Promise<wikiQuery.PageView | null>;
  topic(slug: string): Promise<ViewerTopic | null>;
  search(query: string): Promise<{ query: string; pages: ViewerPageSummary[] }>;
  suggest(query: string): Promise<{ query: string; pages: ViewerPageSummary[] }>;
  file(path: string): Promise<{ path: string; pages: ViewerPageSummary[] }>;
  review(): Promise<ViewerReview>;
  jobs(): Promise<{ runs: ViewerJobRun[] }>;
  job(jobId: string): Promise<ViewerJobDetail | null>;
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
          recentPages: wikiQuery.pages.recentPages(db, 60),
          topics: wikiQuery.topics.topicSummaries(db, { rootsOnly: false, order: "page_count" }),
          rootTopics: wikiQuery.topics.topicSummaries(db, {
            rootsOnly: true,
            limit: topicNavigation.source === "curated" ? 24 : topicNavigation.sidebarLimit,
            order: "page_count",
          }),
          topicNavigation,
          featuredPages: {
            gettingStarted: wikiQuery.pages.pageSummaryBySlug(db, "getting-started"),
          },
        };
      });
    },

    async page(slug) {
      return withFreshDb(ctx.repoRoot, async (db) => {
        const page = await wikiQuery.getPageView(db, toKebabCase(slug));
        if (page === null) return null;
        const relatedSlugs = Array.from(new Set([
          ...page.wikilinks_in,
          ...page.wikilinks_out,
          ...page.supersedes,
          ...(page.superseded_by !== null ? [page.superseded_by] : []),
        ]));
        const related_pages = wikiQuery.pages.pagesBySlug(db, relatedSlugs);
        return { ...page, related_pages };
      });
    },

    async topic(slug) {
      return withFreshDb(ctx.repoRoot, (db) => {
        return wikiQuery.topics.topicDetail(db, slug);
      });
    },

    async search(query) {
      return withFreshDb(ctx.repoRoot, (db) => {
        return wikiQuery.pages.searchPages(db, { query, limit: 50 });
      });
    },

    async suggest(query) {
      return withFreshDb(ctx.repoRoot, (db) => {
        const trimmed = query.trim();
        if (trimmed.length === 0) return { query: trimmed, pages: [] };
        return wikiQuery.pages.searchPages(db, { query: trimmed, limit: 8, prefix: true });
      });
    },

    async file(path) {
      return withFreshDb(ctx.repoRoot, (db) => {
        return wikiQuery.pages.pagesMentioningPath(db, path);
      });
    },

    async review() {
      return getViewerReview(ctx.repoRoot);
    },

    async jobs() {
      return getViewerJobs(ctx.repoRoot, ctx.runtime);
    },

    async job(jobId) {
      return withFreshDb(ctx.repoRoot, async (db) => {
        return getViewerJobDetail(ctx.repoRoot, jobId, db, ctx.runtime);
      });
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
