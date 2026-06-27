import { existsSync } from "node:fs";
import { utimes } from "node:fs/promises";
import { join } from "node:path";

import type Database from "better-sqlite3";

import {
  pagesNewerThan,
  topicsYamlNewerThan,
} from "./freshness.js";
import {
  buildIndexedPagesPlan,
  type ExistingIndexedPage,
} from "./page-plan.js";
import { applyIndexedPagesPlan } from "./page-writer.js";
import { isIndexSchemaStale, openIndex } from "./schema.js";
import { applyTopicsYaml, TOPICS_YAML_FILENAME } from "./topics-yaml.js";
import {
  indexerWarningSink,
  type IndexerWarningSink,
} from "./warnings.js";

export interface IndexContext {
  /** Absolute path to the repo root (the dir containing `.almanac/`). */
  repoRoot: string;
  /** Receives non-fatal index warnings such as malformed frontmatter. */
  warnings?: IndexerWarningSink;
}

export interface IndexResult {
  /** Pages parsed or re-parsed during this run. Zero when the DB was already up to date. */
  changed: number;
  /** Pages present in the DB before this run but missing from disk. */
  removed: number;
  /**
   * Pages on disk at the end of this run — i.e. files that made it all the
   * way through to the index. Skipped files (slug collisions, unreadable,
   * un-sluggable filenames) are NOT counted here. Use `filesSeen` for the
   * raw count of `.md` files encountered on disk.
   *
   * Alias retained for backwards-compat with existing tests/consumers; new
   * code should prefer `pagesIndexed` for clarity.
   */
  total: number;
  /** Pages that made it into the index. Same number as `total`. */
  pagesIndexed: number;
  /**
   * Count of `.md` files found under `pages/` before any filtering. Always
   * `>= pagesIndexed`; the difference is `filesSkipped`.
   */
  filesSeen: number;
  /**
   * Files dropped before making it into the index — slug collisions,
   * un-sluggable filenames, or filesystem races (deleted/unreadable mid-run).
   * Covered by indexer warnings when callers provide a warning sink.
   */
  filesSkipped: number;
}

/**
 * The "front door" for query commands. Runs the indexer only if the DB is
 * missing or at least one page is newer than it. Meant to be cheap — the
 * common case is "nothing changed, mtime check returns fast, we're done".
 *
 * The spec is explicit: "Reindex is implicit and invisible. If the user
 * didn't didn't explicitly run `reindex`, they shouldn't see reindex
 * output. Silent by default." So this function never writes to stdout or
 * stderr; callers may pass a warning sink when a CLI command wants to
 * surface non-fatal indexing issues.
 */
export async function ensureFreshIndex(ctx: IndexContext): Promise<IndexResult> {
  const almanacDir = join(ctx.repoRoot, ".almanac");
  const dbPath = join(almanacDir, "index.db");
  const pagesDir = join(almanacDir, "pages");

  if (!existsSync(pagesDir)) {
    // No pages dir = nothing to index. Open/create the DB so downstream
    // queries can run against an empty schema rather than crashing on a
    // missing file.
    const db = openIndex(dbPath);
    db.close();
    return emptyResult();
  }

  if (indexNeedsRefresh({ almanacDir, dbPath, pagesDir })) {
    return runIndexer(ctx);
  }
  return emptyResult();
}

function indexNeedsRefresh(args: {
  almanacDir: string;
  dbPath: string;
  pagesDir: string;
}): boolean {
  if (!existsSync(args.dbPath)) return true;
  if (isIndexSchemaStale(args.dbPath)) return true;

  // Keep read-side freshness even when CLI/agent write paths eagerly
  // reindex: users can still change `.almanac/pages/` directly via
  // manual edits, git pulls, merges, or branch switches.
  return (
    pagesNewerThan(args.pagesDir, args.dbPath) ||
    topicsYamlNewerThan(args.almanacDir, args.dbPath)
  );
}

function emptyResult(): IndexResult {
  return {
    changed: 0,
    removed: 0,
    total: 0,
    pagesIndexed: 0,
    filesSeen: 0,
    filesSkipped: 0,
  };
}

/**
 * Force a full reindex. Identical to `ensureFreshIndex` except it runs
 * the indexer unconditionally. Exposed for `almanac reindex`.
 */
export async function runIndexer(ctx: IndexContext): Promise<IndexResult> {
  const warnings = indexerWarningSink(ctx.warnings);
  const almanacDir = join(ctx.repoRoot, ".almanac");
  const dbPath = join(almanacDir, "index.db");
  const pagesDir = join(almanacDir, "pages");

  const db = openIndex(dbPath);
  let result: IndexResult;
  try {
    result = await indexPagesInto(db, pagesDir, warnings);
    // After pages are indexed, reconcile the topics table against
    // `.almanac/topics.yaml` (if present). `indexPagesInto` has already
    // lazily inserted rows for every topic slug mentioned in page
    // frontmatter with a title-cased title; `applyTopicsYaml` now
    // promotes the declared title/description and rewrites parent edges
    // for those topics that live in the file.
    await applyTopicsYaml(db, join(almanacDir, TOPICS_YAML_FILENAME), {
      warnings,
    });
  } finally {
    db.close();
  }

  // Bump the DB mtime to "now" after a successful reindex (even a no-op
  // one). Otherwise, a page file with a future mtime (clock skew,
  // `git checkout` preserving source mtimes) would trigger `ensureFreshIndex`
  // on every query: the freshness check sees `page.mtime > db.mtime`,
  // reindex runs, finds no content-hash changes, and the DB mtime stays
  // stale — locking us into a reindex-on-every-query loop. Touching the
  // DB mtime makes the comparison monotonic.
  try {
    const now = new Date();
    await utimes(dbPath, now, now);
  } catch {
    // Touching mtime is a freshness optimization; failures here are
    // non-fatal and the reindex result is still correct.
  }
  return result;
}

async function indexPagesInto(
  db: Database.Database,
  pagesDir: string,
  warnings: IndexerWarningSink,
): Promise<IndexResult> {
  // Load the current state of the index into memory so we can diff against
  // what's on disk. This is cheap even at 10k pages (one INTEGER + two
  // short strings per row).
  const existingRows = db
    .prepare<[], ExistingIndexedPage>(
      "SELECT slug, content_hash, file_path FROM pages",
    )
    .all();
  const plan = await buildIndexedPagesPlan({
    pagesDir,
    existingRows,
    warnings,
  });
  applyIndexedPagesPlan(db, plan);

  return {
    changed: plan.planned.length,
    removed: plan.toDelete.length,
    total: plan.pagesIndexed,
    pagesIndexed: plan.pagesIndexed,
    filesSeen: plan.filesSeen,
    filesSkipped: plan.filesSkipped,
  };
}
