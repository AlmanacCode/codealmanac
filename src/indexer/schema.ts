import Database from "better-sqlite3";

/**
 * Schema DDL, applied on every open. All statements are `CREATE ... IF NOT
 * EXISTS` so this is idempotent — handy when the file already exists but
 * was written by an older version, and tolerable because the schema is
 * append-only (new tables don't collide).
 *
 * Departures from the raw spec, explained:
 *   - `page_topics.topic_slug` has no FK to `topics(slug)`. Topics are
 *     created lazily when a page declares them; a strict FK would force us
 *     to upsert topic rows before the page rows, which doesn't buy us
 *     anything in slice 2 and locks us out of slice 3's "no explicit topic
 *     registration needed" behavior.
 *   - `wikilinks.target_slug` / `cross_wiki_links.target_slug` also have
 *     no FK — these can be intentionally broken (unwritten target page),
 *     and `almanac health` will surface them in slice 3.
 *
 * `file_refs` carries TWO forms of each path:
 *   - `path`          — normalized + lowercased, used for GLOB/equality
 *                       queries (`--mentions`). Stable across casing
 *                       choices on macOS/Windows.
 *   - `original_path` — as-written (normalized slashes, no `./`, trailing
 *                       `/` for dirs), preserving the author's casing.
 *                       Used for filesystem stats (dead-refs on
 *                       case-sensitive filesystems like Linux) and for
 *                       user-facing display (`almanac info`).
 *
 * See also: `SCHEMA_VERSION` below and the migration logic in `openIndex`.
 */
const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS pages (
  slug          TEXT PRIMARY KEY,
  title         TEXT,
  summary       TEXT,
  file_path     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  updated_at    INTEGER NOT NULL,
  archived_at   INTEGER,
  superseded_by TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  slug        TEXT PRIMARY KEY,
  title       TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS page_topics (
  page_slug  TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  PRIMARY KEY (page_slug, topic_slug)
);

CREATE TABLE IF NOT EXISTS topic_parents (
  child_slug  TEXT NOT NULL,
  parent_slug TEXT NOT NULL,
  PRIMARY KEY (child_slug, parent_slug),
  CHECK (child_slug != parent_slug)
);

CREATE TABLE IF NOT EXISTS file_refs (
  page_slug     TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  original_path TEXT NOT NULL,
  is_dir        INTEGER NOT NULL,
  PRIMARY KEY (page_slug, path)
);
CREATE INDEX IF NOT EXISTS idx_file_refs_path ON file_refs(path);

CREATE TABLE IF NOT EXISTS wikilinks (
  source_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  target_slug TEXT NOT NULL,
  PRIMARY KEY (source_slug, target_slug)
);

CREATE TABLE IF NOT EXISTS cross_wiki_links (
  source_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  target_wiki TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  PRIMARY KEY (source_slug, target_wiki, target_slug)
);

-- NOTE: virtual FTS5 table — ON DELETE CASCADE from pages does NOT apply.
-- The indexer must explicitly DELETE FROM fts_pages whenever it removes
-- or replaces a page row, or we leak orphaned FTS rows.
CREATE VIRTUAL TABLE IF NOT EXISTS fts_pages USING fts5(slug, title, content);
`;

/**
 * Bump this whenever the schema changes in a backwards-incompatible way.
 * On open we compare the stored `user_version` against this constant; if
 * it's lower, we drop the affected tables so the next `runIndexer` can
 * rebuild them. Full reindex is cheap (everything lives on disk as
 * markdown), so "drop + recreate" is simpler than ALTER TABLE migrations.
 *
 * Version history:
 *   1 — initial slice-2 schema
 *   2 — slice-3-review: added `file_refs.original_path`
 *   3 — added `pages.summary`
 */
const SCHEMA_VERSION = 3;

export function isIndexSchemaStale(dbPath: string): boolean {
  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return true;
  }
  try {
    const rawVersion = db.pragma("user_version", { simple: true });
    const currentVersion = typeof rawVersion === "number" ? rawVersion : 0;
    return currentVersion < SCHEMA_VERSION;
  } finally {
    db.close();
  }
}

/**
 * Open `index.db` and apply the schema. Foreign keys are off by default in
 * SQLite; we turn them on per-connection so the ON DELETE CASCADE on
 * `pages` actually fires when we delete stale rows during incremental
 * reindex.
 *
 * We don't wrap this open in a transaction — `CREATE ... IF NOT EXISTS` is
 * safe to run repeatedly and the FTS5 virtual-table creation is already
 * atomic.
 *
 * Migration: if the DB was created by an older schema (`user_version` <
 * `SCHEMA_VERSION`), we drop the tables whose shape changed and let the
 * CREATE IF NOT EXISTS below rebuild them. The next `runIndexer` repopulates
 * from the filesystem — cheap and avoids the ALTER TABLE dance.
 */
export function openIndex(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  // WAL journal mode is persistent — once set, it's recorded in the DB
  // header and survives close/open cycles. Check first and only switch if
  // we're not already there; this avoids a redundant pragma write on every
  // query command.
  const mode = db.pragma("journal_mode", { simple: true });
  if (typeof mode !== "string" || mode.toLowerCase() !== "wal") {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("foreign_keys = ON");

  const rawVersion = db.pragma("user_version", { simple: true });
  const currentVersion = typeof rawVersion === "number" ? rawVersion : 0;
  if (currentVersion < SCHEMA_VERSION) {
    if (currentVersion < 2) {
      // Drop tables whose shape changed. `file_refs` got `original_path`
      // as of v2; easiest to drop it entirely so CREATE IF NOT EXISTS
      // runs with the new definition. Pages/topics/links are untouched.
      db.exec("DROP TABLE IF EXISTS file_refs");
    }
    if (currentVersion < 3) {
      try {
        db.exec("ALTER TABLE pages ADD COLUMN summary TEXT");
      } catch {
        // pages table may not exist yet, or a partially migrated DB may
        // already have the column. The schema DDL below covers fresh DBs.
      }
    }
    // The indexer's fast-path skips pages whose content_hash matches.
    // After metadata/table migrations, clear the hash column so the next
    // reindex treats every page as changed and repopulates derived rows.
    // Table may not exist yet on a brand-new DB, so swallow errors.
    try {
      db.exec("UPDATE pages SET content_hash = ''");
    } catch {
      // pages table didn't exist yet; the upcoming CREATE IF NOT EXISTS
      // takes care of a fresh install.
    }
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  db.exec(SCHEMA_DDL);
  return db;
}
