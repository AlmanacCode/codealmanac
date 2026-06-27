import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import {
  collectHealthReport as collectIndexerHealthReport,
  DEFAULT_STALE_SECONDS,
  type HealthReport,
} from "../../wiki/health/index.js";

export interface CheckWikiHealthRequest {
  cwd: string;
  wiki?: string;
  topic?: string;
  staleSeconds: number;
  stdinSlugs?: string[];
}

export interface CollectWikiHealthReportRequest {
  repoRoot: string;
  topic?: string;
  staleSeconds?: number;
  stdinSlugs?: string[];
}

export interface WikiHealthReport {
  orphans: { slug: string }[];
  stale: { slug: string; days_since_update: number }[];
  dead_refs: { slug: string; path: string }[];
  broken_links: { source_slug: string; target_slug: string }[];
  broken_xwiki: {
    source_slug: string;
    target_wiki: string;
    target_slug: string;
  }[];
  missing_sources: { slug: string; source_id: string }[];
  unused_sources: { slug: string; source_id: string }[];
  legacy_frontmatter: { slug: string; fields: string[] }[];
  unfixable_sources: { slug: string; source: string }[];
  duplicate_sources: { slug: string; source_id: string }[];
  empty_topics: { slug: string }[];
  empty_pages: { slug: string }[];
  slug_collisions: { slug: string; paths: string[] }[];
}

export type CollectWikiHealthReport = (
  request: CollectWikiHealthReportRequest,
) => Promise<WikiHealthReport>;

export { DEFAULT_STALE_SECONDS };

export async function checkWikiHealth(
  request: CheckWikiHealthRequest,
): Promise<WikiHealthReport> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  return collectWikiHealthReport({
    repoRoot,
    topic: request.topic,
    staleSeconds: request.staleSeconds,
    stdinSlugs: request.stdinSlugs,
  });
}

export async function collectWikiHealthReport(
  request: CollectWikiHealthReportRequest,
): Promise<WikiHealthReport> {
  return wikiHealthReportFromIndexerReport(
    await collectIndexerHealthReport({
      repoRoot: request.repoRoot,
      topic: request.topic,
      staleSeconds: request.staleSeconds,
      stdinSlugs: request.stdinSlugs,
    }),
  );
}

function wikiHealthReportFromIndexerReport(
  report: HealthReport,
): WikiHealthReport {
  return {
    orphans: report.orphans.map((item) => ({ slug: item.slug })),
    stale: report.stale.map((item) => ({
      slug: item.slug,
      days_since_update: item.days_since_update,
    })),
    dead_refs: report.dead_refs.map((item) => ({
      slug: item.slug,
      path: item.path,
    })),
    broken_links: report.broken_links.map((item) => ({
      source_slug: item.source_slug,
      target_slug: item.target_slug,
    })),
    broken_xwiki: report.broken_xwiki.map((item) => ({
      source_slug: item.source_slug,
      target_wiki: item.target_wiki,
      target_slug: item.target_slug,
    })),
    missing_sources: report.missing_sources.map((item) => ({
      slug: item.slug,
      source_id: item.source_id,
    })),
    unused_sources: report.unused_sources.map((item) => ({
      slug: item.slug,
      source_id: item.source_id,
    })),
    legacy_frontmatter: report.legacy_frontmatter.map((item) => ({
      slug: item.slug,
      fields: [...item.fields],
    })),
    unfixable_sources: report.unfixable_sources.map((item) => ({
      slug: item.slug,
      source: item.source,
    })),
    duplicate_sources: report.duplicate_sources.map((item) => ({
      slug: item.slug,
      source_id: item.source_id,
    })),
    empty_topics: report.empty_topics.map((item) => ({ slug: item.slug })),
    empty_pages: report.empty_pages.map((item) => ({ slug: item.slug })),
    slug_collisions: report.slug_collisions.map((item) => ({
      slug: item.slug,
      paths: [...item.paths],
    })),
  };
}
