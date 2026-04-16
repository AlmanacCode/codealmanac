import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile, utimes } from "node:fs/promises";
import { basename, join, relative } from "node:path";

import fg from "fast-glob";
import type Database from "better-sqlite3";

import { toKebabCase } from "../slug.js";
import { loadTopicsFile, titleCase } from "../topics/yaml.js";
import { firstH1, parseFrontmatter } from "./frontmatter.js";
import { normalizePath, looksLikeDir } from "./paths.js";
import { openIndex } from "./schema.js";
import { extractWikilinks } from "./wikilinks.js";

/**
 * Filename relative to the `.almanac/` dir where the topic DAG + metadata
 * lives. The indexer loads it on every reindex; the topics commands
 * mutate it atomically. Keep this in sync with `src/topics/paths.ts`'s
 * `topicsYamlPath` — duplicated here only so the indexer doesn't import
 * a second "where is it" helper.
 */
const TOPICS_YAML_FILENAME = "topics.yaml";

export interface IndexContext {
  /** Absolute path to the repo root (the dir containing `.almanac/`). */
  repoRoot: string;
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
   * Covered by stderr warnings when non-zero.
   */
  filesSkipped: number;
}

// Glob is relative to `pagesDir` (which is `.almanac/pages/`), so this is
// just "every .md at any depth" — not `pages/**/*.md`, because we've
// already `cd`'d into `pages/` logically.
const PAGES_GLOB = "**/*.md";

/**
 * The "front door" for query commands. Runs the indexer only if the DB is
 * missing or at least one page is newer than it. Meant to be cheap — the
 * common case is "nothing changed, mtime check returns fast, we're done".
 *
 * The spec is explicit: "Reindex is implicit and invisible. If the user
 * didn't didn't explicitly run `reindex`, they shouldn't see reindex
 * output. Silent by default." So this function never writes to stdout;
 * warnings (slug collisions, bad frontmatter) still go to stderr.
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

  if (
    !existsSync(dbPath) ||
    pagesNewerThan(pagesDir, dbPath) ||
    topicsYamlNewerThan(almanacDir, dbPath)
  ) {
    return runIndexer(ctx);
  }
  return emptyResult();
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
  const almanacDir = join(ctx.repoRoot, ".almanac");
  const dbPath = join(almanacDir, "index.db");
  const pagesDir = join(almanacDir, "pages");

  const db = openIndex(dbPath);
  let result: IndexResult;
  try {
    result = await indexPagesInto(db, pagesDir);
    // After pages are indexed, reconcile the topics table against
    // `.almanac/topics.yaml` (if present). `indexPagesInto` has already
    // lazily inserted rows for every topic slug mentioned in page
    // frontmatter with a title-cased title; `applyTopicsYaml` now
    // promotes the declared title/description and rewrites parent edges
    // for those topics that live in the file.
    await applyTopicsYaml(db, join(almanacDir, TOPICS_YAML_FILENAME));
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

interface ExistingRow {
  slug: string;
  content_hash: string;
  file_path: string;
}

async function indexPagesInto(
  db: Database.Database,
  pagesDir: string,
): Promise<IndexResult> {
  const files = await fg(PAGES_GLOB, {
    cwd: pagesDir,
    absolute: false,
    onlyFiles: true,
    caseSensitiveMatch: true,
  });

  // Load the current state of the index into memory so we can diff against
  // what's on disk. This is cheap even at 10k pages (one INTEGER + two
  // short strings per row).
  const existingRows = db
    .prepare<[], ExistingRow>("SELECT slug, content_hash, file_path FROM pages")
    .all();
  const existingBySlug = new Map<string, ExistingRow>();
  for (const row of existingRows) existingBySlug.set(row.slug, row);

  // First pass: decide what to do with each file on disk. We record the
  // intent here so the transaction below can run synchronously — mixing
  // async file reads into a better-sqlite3 transaction doesn't work
  // (transactions are sync).
  const planned: Array<{
    slug: string;
    title: string;
    filePath: string;
    fullPath: string;
    contentHash: string;
    updatedAt: number;
    archivedAt: number | null;
    supersededBy: string | null;
    topics: string[];
    frontmatterFiles: string[];
    wikilinks: ReturnType<typeof extractWikilinks>;
    content: string;
  }> = [];
  const seenSlugs = new Set<string>();
  let filesSkipped = 0;

  for (const rel of files) {
    const fullPath = join(pagesDir, rel);
    const base = basename(rel, ".md");
    const slug = toKebabCase(base);
    if (slug.length === 0) {
      process.stderr.write(
        `almanac: skipping "${rel}" — filename has no slug-able characters\n`,
      );
      filesSkipped++;
      continue;
    }
    if (slug !== base) {
      // Filename isn't already canonical kebab-case. Warn, but still
      // index under the canonical slug. `almanac health` (slice 3) will
      // surface these as a proper report.
      process.stderr.write(
        `almanac: warning — "${rel}" is not canonical; indexed as slug "${slug}"\n`,
      );
    }
    if (seenSlugs.has(slug)) {
      // Two files slugify to the same slug. Keep the first, skip the
      // rest — health will flag this properly in slice 3.
      process.stderr.write(
        `almanac: warning — slug "${slug}" collides with an earlier file; skipping "${rel}"\n`,
      );
      filesSkipped++;
      continue;
    }

    // `fast-glob` gave us the list in one shot, but by the time we stat
    // and read each file it can have been deleted, renamed, or swapped
    // (editors that save via rename-swap expose this briefly). A single
    // such race shouldn't tank the whole reindex — matches the malformed-
    // YAML behavior ("one bad file doesn't stop the others"). We narrow
    // to ENOENT/EACCES so genuine I/O failures (EIO, EMFILE, etc.) still
    // surface.
    let st: ReturnType<typeof statSync>;
    let raw: string;
    try {
      st = statSync(fullPath);
      raw = await readFile(fullPath, "utf8");
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err.code === "ENOENT" || err.code === "EACCES")
      ) {
        process.stderr.write(
          `almanac: skipping "${rel}" — ${err.message}\n`,
        );
        filesSkipped++;
        continue;
      }
      throw err;
    }

    seenSlugs.add(slug);
    const updatedAt = Math.floor(st.mtimeMs / 1000);

    // Content-hash skip: if the hash matches what's in the DB and the
    // file path hasn't moved, we can leave this page's rows alone. This
    // is the fast-path for "user ran a query; one page was touched".
    const contentHash = hashContent(raw);
    const existing = existingBySlug.get(slug);
    if (
      existing !== undefined &&
      existing.content_hash === contentHash &&
      existing.file_path === fullPath
    ) {
      continue;
    }

    const fm = parseFrontmatter(raw);
    const title = fm.title ?? firstH1(fm.body) ?? base;
    const links = extractWikilinks(fm.body);

    planned.push({
      slug,
      title,
      filePath: rel,
      fullPath,
      contentHash,
      updatedAt,
      archivedAt: fm.archived_at,
      supersededBy: fm.superseded_by,
      topics: fm.topics,
      frontmatterFiles: fm.files,
      wikilinks: links,
      content: fm.body,
    });
  }

  // Compute deletions: anything in the DB whose slug isn't on disk
  // anymore (or whose file slugifies to a different slug now).
  const toDelete: string[] = [];
  for (const slug of existingBySlug.keys()) {
    if (!seenSlugs.has(slug)) toDelete.push(slug);
  }

  const deleteByPage = db.prepare<[string]>("DELETE FROM pages WHERE slug = ?");
  const deleteFtsByPage = db.prepare<[string]>(
    "DELETE FROM fts_pages WHERE slug = ?",
  );

  const replacePage = db.prepare<
    [string, string, string, string, number, number | null, string | null]
  >(
    `INSERT INTO pages (slug, title, file_path, content_hash, updated_at, archived_at, superseded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       title         = excluded.title,
       file_path     = excluded.file_path,
       content_hash  = excluded.content_hash,
       updated_at    = excluded.updated_at,
       archived_at   = excluded.archived_at,
       superseded_by = excluded.superseded_by`,
  );

  const deletePageTopics = db.prepare<[string]>(
    "DELETE FROM page_topics WHERE page_slug = ?",
  );
  const insertPageTopic = db.prepare<[string, string]>(
    "INSERT OR IGNORE INTO page_topics (page_slug, topic_slug) VALUES (?, ?)",
  );
  // Seed ad-hoc topics with a title-cased default. If the topic is
  // later declared in `.almanac/topics.yaml`, `applyTopicsYaml` will
  // promote the title/description to whatever the file says. We set the
  // title here (rather than leaving NULL) so `topics list` and
  // `health --topic` have a display name even before a user writes to
  // topics.yaml.
  const insertTopic = db.prepare<[string, string]>(
    "INSERT OR IGNORE INTO topics (slug, title) VALUES (?, ?)",
  );

  const deleteFileRefs = db.prepare<[string]>(
    "DELETE FROM file_refs WHERE page_slug = ?",
  );
  const insertFileRef = db.prepare<[string, string, number]>(
    "INSERT OR IGNORE INTO file_refs (page_slug, path, is_dir) VALUES (?, ?, ?)",
  );

  const deleteWikilinks = db.prepare<[string]>(
    "DELETE FROM wikilinks WHERE source_slug = ?",
  );
  const insertWikilink = db.prepare<[string, string]>(
    "INSERT OR IGNORE INTO wikilinks (source_slug, target_slug) VALUES (?, ?)",
  );

  const deleteXwiki = db.prepare<[string]>(
    "DELETE FROM cross_wiki_links WHERE source_slug = ?",
  );
  const insertXwiki = db.prepare<[string, string, string]>(
    "INSERT OR IGNORE INTO cross_wiki_links (source_slug, target_wiki, target_slug) VALUES (?, ?, ?)",
  );

  const insertFts = db.prepare<[string, string, string]>(
    "INSERT INTO fts_pages (slug, title, content) VALUES (?, ?, ?)",
  );

  const apply = db.transaction(() => {
    for (const slug of toDelete) {
      // `fts_pages` is an FTS5 virtual table — FK cascades do NOT propagate
      // into it, so we must delete FTS rows explicitly before relying on
      // `DELETE FROM pages` to cascade-clean the four real tables
      // (page_topics, file_refs, wikilinks, cross_wiki_links). If this
      // explicit delete ever gets removed, orphaned FTS rows will show up
      // as phantom search hits pointing at non-existent slugs.
      deleteFtsByPage.run(slug);
      deleteByPage.run(slug); // CASCADE cleans page_topics, file_refs, wikilinks, cross_wiki_links
    }

    for (const p of planned) {
      // page_topics/file_refs/wikilinks/cross_wiki_links all cascade on
      // delete, so the cleanest "replace" story is: delete-then-insert
      // the per-page rows under the same transaction. Doing it this way
      // (rather than `ON CONFLICT DO UPDATE` per row) keeps the logic
      // uniform and makes "remove a topic from frontmatter" work.
      deletePageTopics.run(p.slug);
      deleteFileRefs.run(p.slug);
      deleteWikilinks.run(p.slug);
      deleteXwiki.run(p.slug);
      // Same virtual-table reason as the deletion branch above — FTS5
      // rows do not cascade, so clean them by hand before reinserting.
      deleteFtsByPage.run(p.slug);

      replacePage.run(
        p.slug,
        p.title,
        p.fullPath,
        p.contentHash,
        p.updatedAt,
        p.archivedAt,
        p.supersededBy,
      );

      for (const topic of p.topics) {
        const topicSlug = toKebabCase(topic);
        if (topicSlug.length === 0) continue;
        insertTopic.run(topicSlug, titleCase(topicSlug));
        insertPageTopic.run(p.slug, topicSlug);
      }

      // Frontmatter `files:` — normalize each entry, inferring directness
      // from its trailing slash. Authors who write `src/payments` (no
      // trailing slash) are asserting a file; this matches how `[[...]]`
      // classifies the same string.
      for (const raw of p.frontmatterFiles) {
        const isDir = looksLikeDir(raw);
        const path = normalizePath(raw, isDir);
        if (path.length === 0) continue;
        insertFileRef.run(p.slug, path, isDir ? 1 : 0);
      }

      // Inline `[[...]]` extracted from body.
      for (const ref of p.wikilinks) {
        switch (ref.kind) {
          case "page":
            insertWikilink.run(p.slug, ref.target);
            break;
          case "file":
            insertFileRef.run(p.slug, ref.path, 0);
            break;
          case "folder":
            insertFileRef.run(p.slug, ref.path, 1);
            break;
          case "xwiki":
            insertXwiki.run(p.slug, ref.wiki, ref.target);
            break;
        }
      }

      insertFts.run(p.slug, p.title, p.content);
    }
  });
  apply();

  // `relative` keeps lint happy about unused imports; total is just the
  // count of .md files we saw on this pass.
  void relative;
  const pagesIndexed = seenSlugs.size;
  return {
    changed: planned.length,
    removed: toDelete.length,
    total: pagesIndexed,
    pagesIndexed,
    filesSeen: files.length,
    filesSkipped,
  };
}

/**
 * Return true if any `pages/**\/*.md` has an mtime strictly greater than
 * the index DB's mtime. We walk with `fast-glob` rather than shell out to
 * `find` for portability.
 *
 * This is the "should we reindex?" check. It's intentionally cheap —
 * `fast-glob` with `stats: true` gives us mtimes without a second `stat`
 * round-trip.
 */
function pagesNewerThan(pagesDir: string, dbPath: string): boolean {
  let dbMtime: number;
  try {
    dbMtime = statSync(dbPath).mtimeMs;
  } catch {
    return true;
  }

  // Synchronous walk — `fg.sync` is fine at this scale and keeps the
  // decision path simple (we don't need to await inside every CLI entry).
  const entries = fg.sync(PAGES_GLOB, {
    cwd: pagesDir,
    absolute: true,
    onlyFiles: true,
    stats: true,
  }) as Array<{ path: string; stats?: { mtimeMs: number } }>;

  for (const entry of entries) {
    const mtime = entry.stats?.mtimeMs;
    if (mtime !== undefined && mtime > dbMtime) return true;
  }
  return false;
}

function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Return true if `topics.yaml` has an mtime strictly greater than the
 * index DB's mtime. This is the topics-side mirror of `pagesNewerThan`
 * — mutations to `topics.yaml` (title/description/parents) aren't
 * visible from any page mtime, so we need a separate freshness hook
 * for the file itself.
 *
 * Missing `topics.yaml` → false. Absence is legal and means "no topic
 * metadata, only whatever pages declare". A missing file doesn't
 * invalidate the existing index.
 */
function topicsYamlNewerThan(almanacDir: string, dbPath: string): boolean {
  const path = join(almanacDir, "topics.yaml");
  if (!existsSync(path)) return false;
  let dbMtime: number;
  try {
    dbMtime = statSync(dbPath).mtimeMs;
  } catch {
    return true;
  }
  try {
    const st = statSync(path);
    return st.mtimeMs > dbMtime;
  } catch {
    return false;
  }
}

/**
 * Apply the contents of `.almanac/topics.yaml` to SQLite.
 *
 * Called at the tail of every reindex. For each entry in the file we
 * upsert a row into `topics` (with title + description) and rewrite
 * that topic's edges in `topic_parents`. Topics that were ad-hoc-only
 * before (mentioned in page frontmatter, never `almanac topics
 * create`d) get their display name promoted to whatever is in the
 * file.
 *
 * Importantly, we do NOT delete `topics` rows that live only in page
 * frontmatter — those are legal, per the spec ("any slug mentioned in
 * pages' `topics:` frontmatter gets a row, even if not in
 * topics.yaml"). We also do NOT clear `topic_parents` wholesale; we
 * rewrite edges for each declared topic but leave untouched rows for
 * ad-hoc topics (which by definition have no declared parents).
 *
 * Missing file = no-op. This is the "no topic metadata yet" state and
 * callers shouldn't have to paper over it.
 */
async function applyTopicsYaml(
  db: Database.Database,
  topicsYamlPath: string,
): Promise<void> {
  if (!existsSync(topicsYamlPath)) return;
  let file;
  try {
    file = await loadTopicsFile(topicsYamlPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`almanac: ${message}\n`);
    return;
  }

  const upsertTopic = db.prepare<[string, string, string | null]>(
    `INSERT INTO topics (slug, title, description) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title,
       description = excluded.description`,
  );
  const clearParents = db.prepare<[string]>(
    "DELETE FROM topic_parents WHERE child_slug = ?",
  );
  const insertParent = db.prepare<[string, string]>(
    "INSERT OR IGNORE INTO topic_parents (child_slug, parent_slug) VALUES (?, ?)",
  );

  // Collect every slug we consider "declared" — in topics.yaml or
  // referenced by any page_topics row. Anything outside this set is
  // stale (e.g., a topic that used to be in the file before a rename
  // or delete, or an ad-hoc slug whose only page just got untagged).
  // Those get removed so `empty-topics` doesn't falsely flag them.
  const declared = new Set<string>();
  for (const t of file.topics) declared.add(t.slug);
  const adHoc = db
    .prepare<[], { topic_slug: string }>(
      "SELECT DISTINCT topic_slug FROM page_topics",
    )
    .all();
  for (const r of adHoc) declared.add(r.topic_slug);

  const apply = db.transaction(() => {
    for (const t of file.topics) {
      upsertTopic.run(t.slug, t.title, t.description);
      clearParents.run(t.slug);
      for (const parent of t.parents) {
        if (parent === t.slug) continue;
        insertParent.run(t.slug, parent);
      }
    }

    // Prune stale topic rows + any edges attached to them. We do this
    // last so the upserts above have already promoted declared slugs.
    const existing = db
      .prepare<[], { slug: string }>("SELECT slug FROM topics")
      .all();
    const deleteTopic = db.prepare<[string]>("DELETE FROM topics WHERE slug = ?");
    const deleteEdgesByChild = db.prepare<[string]>(
      "DELETE FROM topic_parents WHERE child_slug = ?",
    );
    const deleteEdgesByParent = db.prepare<[string]>(
      "DELETE FROM topic_parents WHERE parent_slug = ?",
    );
    for (const r of existing) {
      if (declared.has(r.slug)) continue;
      deleteEdgesByChild.run(r.slug);
      deleteEdgesByParent.run(r.slug);
      deleteTopic.run(r.slug);
    }
  });
  apply();
}
