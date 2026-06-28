import { join } from "node:path";

import { ensureFreshIndex } from "../indexer/index.js";
import { openIndex } from "../indexer/schema.js";
import * as sources from "../sources/index.js";
import {
  findBrokenLinks,
  findBrokenXwiki,
  findDeadRefs,
} from "./link-checks.js";
import {
  findEmptyPages,
  findEmptyTopics,
  findOrphans,
  findSlugCollisions,
  findStale,
} from "./page-checks.js";
import {
  resolveHealthScope,
} from "./scope.js";

/**
 * Health report collection.
 *
 * This module owns wiki-health checks over the SQLite index and filesystem.
 * CLI option parsing and report rendering live in `src/edges/cli/commands/health/`.
 */

export interface HealthReport {
  orphans: { slug: string }[];
  stale: { slug: string; days_since_update: number }[];
  dead_refs: { slug: string; path: string }[];
  broken_links: { source_slug: string; target_slug: string }[];
  broken_xwiki: { source_slug: string; target_wiki: string; target_slug: string }[];
  missing_sources: { slug: string; source_id: string }[];
  unused_sources: { slug: string; source_id: string }[];
  legacy_frontmatter: { slug: string; fields: string[] }[];
  unfixable_sources: { slug: string; source: string }[];
  duplicate_sources: { slug: string; source_id: string }[];
  empty_topics: { slug: string }[];
  empty_pages: { slug: string }[];
  slug_collisions: { slug: string; paths: string[] }[];
}

export interface HealthReportOptions {
  repoRoot: string;
  topic?: string;
  staleSeconds?: number;
  stdinSlugs?: string[];
}

/**
 * Default `--stale` window. 90 days matches the spec. Users can tune
 * with `--stale <duration>` using the shared parser.
 */
export const DEFAULT_STALE_SECONDS = 90 * 24 * 60 * 60;

export async function collectHealthReport(
  options: HealthReportOptions,
): Promise<HealthReport> {
  const repoRoot = options.repoRoot;
  const almanacDir = join(repoRoot, ".almanac");
  const pagesDir = join(almanacDir, "pages");
  const staleSeconds = options.staleSeconds ?? DEFAULT_STALE_SECONDS;

  await ensureFreshIndex({ repoRoot });

  const db = openIndex(join(almanacDir, "index.db"));

  try {
    const scope = resolveHealthScope(db, options);
    const sourceFindings = await sources.collectSourceHealthFindings(db, scope);

    return {
      orphans: findOrphans(db, scope),
      stale: findStale(db, scope, staleSeconds),
      dead_refs: await findDeadRefs(db, scope, repoRoot),
      broken_links: findBrokenLinks(db, scope),
      broken_xwiki: await findBrokenXwiki(db, scope),
      missing_sources: sourceFindings.missing_sources,
      unused_sources: sourceFindings.unused_sources,
      legacy_frontmatter: sourceFindings.legacy_frontmatter,
      unfixable_sources: sourceFindings.unfixable_sources,
      duplicate_sources: sourceFindings.duplicate_sources,
      empty_topics: findEmptyTopics(db, scope),
      empty_pages: await findEmptyPages(db, scope),
      slug_collisions: await findSlugCollisions(pagesDir),
    };
  } finally {
    db.close();
  }
}
