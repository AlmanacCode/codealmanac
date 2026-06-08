import type Database from "better-sqlite3";

import { toKebabCase } from "../../slug.js";
import { subtreeInDb } from "../topics/dag.js";

export interface HealthScopeOptions {
  topic?: string;
  stdinSlugs?: string[];
}

export interface HealthScope {
  /** When non-null, restrict page-scoped checks to these slugs. */
  pages: Set<string> | null;
  /** When non-null, restrict topic-scoped checks to these slugs. */
  topics: Set<string> | null;
}

export function resolveHealthScope(
  db: Database.Database,
  options: HealthScopeOptions,
): HealthScope {
  let pages: Set<string> | null = null;
  let topics: Set<string> | null = null;

  if (options.topic !== undefined) {
    const rootSlug = toKebabCase(options.topic);
    if (rootSlug.length > 0) {
      const subtree = subtreeInDb(db, rootSlug);
      topics = new Set(subtree);
      const placeholders = subtree.map(() => "?").join(", ");
      const rows = db
        .prepare<unknown[], { page_slug: string }>(
          `SELECT DISTINCT page_slug FROM page_topics
           WHERE topic_slug IN (${placeholders})`,
        )
        .all(...subtree);
      pages = new Set(rows.map((r) => r.page_slug));
    }
  }

  if (options.stdinSlugs !== undefined) {
    const stdinPages = new Set(options.stdinSlugs);
    if (pages === null) pages = stdinPages;
    else {
      const out = new Set<string>();
      for (const slug of stdinPages) if (pages.has(slug)) out.add(slug);
      pages = out;
    }
  }

  return { pages, topics };
}

export function inPageScope(scope: HealthScope, slug: string): boolean {
  if (scope.pages === null) return true;
  return scope.pages.has(slug);
}
