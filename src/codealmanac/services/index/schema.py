from pathlib import Path

from codealmanac.database import (
    SQLiteConnection,
    SQLiteMigration,
    apply_migrations,
    connect_sqlite,
)

SCHEMA_VERSION = 2026070101

SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS pages (
  slug          TEXT PRIMARY KEY,
  title         TEXT,
  summary       TEXT,
  file_path     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  updated_at    INTEGER NOT NULL,
  body          TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS page_sources (
  page_slug    TEXT NOT NULL REFERENCES pages(slug) ON DELETE CASCADE,
  source_order INTEGER NOT NULL,
  source_id    TEXT NOT NULL,
  source_type  TEXT NOT NULL,
  target       TEXT,
  title        TEXT,
  retrieved_at TEXT,
  note         TEXT,
  PRIMARY KEY (page_slug, source_order)
);
CREATE INDEX IF NOT EXISTS idx_page_sources_id ON page_sources(page_slug, source_id);
CREATE INDEX IF NOT EXISTS idx_page_sources_type ON page_sources(source_type);

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

CREATE VIRTUAL TABLE IF NOT EXISTS fts_pages USING fts5(slug, title, content);

CREATE TABLE IF NOT EXISTS index_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""

DROP_DERIVED_INDEX_DDL = """
DROP TABLE IF EXISTS cross_wiki_links;
DROP TABLE IF EXISTS wikilinks;
DROP TABLE IF EXISTS page_sources;
DROP TABLE IF EXISTS file_refs;
DROP TABLE IF EXISTS page_topics;
DROP TABLE IF EXISTS topic_parents;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS fts_pages;
DROP TABLE IF EXISTS index_metadata;
"""

INDEX_MIGRATIONS = (
    SQLiteMigration(
        version=SCHEMA_VERSION,
        sql=f"{DROP_DERIVED_INDEX_DDL}\n{SCHEMA_DDL}",
    ),
)


def index_db_path(almanac_path: Path) -> Path:
    return almanac_path / "index.db"


def connect_index(path: Path) -> SQLiteConnection:
    connection = connect_sqlite(path)
    apply_migrations(connection, INDEX_MIGRATIONS)
    return connection
