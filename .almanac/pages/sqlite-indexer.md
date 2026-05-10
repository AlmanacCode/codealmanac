---
title: SQLite Indexer
topics: [systems, storage]
files:
  - src/indexer/schema.ts
  - src/indexer/index.ts
  - src/indexer/frontmatter.ts
  - src/indexer/wikilinks.ts
  - src/indexer/paths.ts
  - src/indexer/resolve-wiki.ts
  - src/indexer/duration.ts
---

# SQLite Indexer

The indexer (`src/indexer/`) builds and maintains `.almanac/index.db` — a SQLite database that powers all query commands (`search`, `show`, `health`, `topics show`). It runs silently before every query command. Freshness checks compare page and topic-file mtimes against the database mtime; once a reindex starts, unchanged page rows are skipped by `content_hash` and `file_path`.

## Schema

Defined in `src/indexer/schema.ts` and applied idempotently on every open (`CREATE ... IF NOT EXISTS`). Tables:

- `pages` — one row per `.md` file: `slug`, `title`, `file_path`, `content_hash`, `updated_at`, `archived_at`, `superseded_by`
- `topics` — topic metadata (slug, title, description); populated from `topics.yaml` at reindex time
- `page_topics` — page↔topic many-to-many; FK cascade-deletes on page removal
- `topic_parents` — DAG edges; has a `CHECK (child_slug != parent_slug)` constraint
- `file_refs` — parsed file/folder links; stores both `path` (lowercased, for GLOB queries) and `original_path` (as-written, for display and case-sensitive dead-ref checks)
- `wikilinks` — page-slug links
- `cross_wiki_links` — cross-wiki links
- `fts_pages` — FTS5 virtual table (slug + title + content); **ON DELETE CASCADE does NOT apply to FTS5 virtual tables**; the indexer must issue an explicit `DELETE FROM fts_pages WHERE slug = ?` before re-inserting a changed page row, or the old content remains searchable alongside the new content

## Schema versioning

`SCHEMA_VERSION` constant (currently `2`). On open, if `user_version < SCHEMA_VERSION`, affected tables are dropped and the hash column is cleared to force a full reindex. Avoids `ALTER TABLE` migrations.

## Path handling

All stored paths are lowercase + forward-slashes + no `./` prefix (normalized at write and query time). `GLOB` is used for path queries, never `LIKE` — `LIKE` treats `_` as a wildcard, and Next.js-style paths like `src/[id]/page.tsx` contain GLOB metacharacters that must be escaped. See [[wikilink-syntax]] for the link classification rules that feed `file_refs`.

## Freshness

`better-sqlite3` (sync SQLite driver). WAL journal mode is set on first open and persists in the DB header. `almanac reindex` clears hashes to force a full rebuild even when the index is otherwise fresh.
