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
 */
const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS pages (
  slug          TEXT PRIMARY KEY,
  title         TEXT,
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
  page_slug TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  path      TEXT NOT NULL,
  is_dir    INTEGER NOT NULL,
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
 * Open `index.db` and apply the schema. Foreign keys are off by default in
 * SQLite; we turn them on per-connection so the ON DELETE CASCADE on
 * `pages` actually fires when we delete stale rows during incremental
 * reindex.
 *
 * We don't wrap this open in a transaction — `CREATE ... IF NOT EXISTS` is
 * safe to run repeatedly and the FTS5 virtual-table creation is already
 * atomic.
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
  db.exec(SCHEMA_DDL);
  return db;
}
