---
title: SQLite Indexer
summary: The SQLite indexer powers query commands but inherits `better-sqlite3`'s Node-version-sensitive native binding behavior.
topics: [systems, storage]
files:
  - src/cli/register-query-commands.ts
  - src/commands/search.ts
  - src/commands/show.ts
  - src/indexer/schema.ts
  - src/indexer/index.ts
  - src/indexer/frontmatter.ts
  - src/indexer/wikilinks.ts
  - src/indexer/paths.ts
  - src/indexer/resolve-wiki.ts
  - src/indexer/duration.ts
  - src/abi-guard.ts
  - src/cli.ts
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/11/rollout-2026-05-11T14-32-08-019e18f4-5e73-7790-ba49-73cc02544a58.jsonl
verified: 2026-05-13
---

# SQLite Indexer

The indexer (`src/indexer/`) builds and maintains `.almanac/index.db` — a SQLite database that powers all query commands (`search`, `show`, `health`, `topics show`). It runs silently before every query command. Freshness checks compare page and topic-file mtimes against the database mtime; once a reindex starts, unchanged page rows are skipped by `content_hash` and `file_path`.

## Query output contract

Query commands should stay quiet by default and reserve richer context for explicit flags. `almanac search` defaults to one slug per line even in a TTY; `--verbose` and the older `--summaries` flag print one-line summaries. `almanac show <slug>` defaults to the page body only; `--verbose` restores the metadata header, separator, and body view. Field flags such as `--title`, `--topics`, `--files`, and JSON output keep their existing explicit shapes.

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

## Native binding constraint

The query stack inherits `better-sqlite3`'s old-ABI native binding behavior: a global or local install can work on one Node version and then fail after an `nvm`/Volta/FNM switch until the package is rebuilt for the new runtime. `src/abi-guard.ts` exists to fail fast with a repair hint instead of surfacing a later opaque `require()` crash.

This constraint explains one CLI boundary elsewhere in the repo: [[lifecycle-cli]] routes `setup` and `automation install|status|uninstall` through a sqlite-free fast path in `src/cli.ts`, so basic onboarding and scheduler repair still work even when the query/index stack cannot load `better-sqlite3`.

[[almanac-doctor]] surfaces the same failure mode as structured install state: `install.sqlite` reports whether the binding loads and prints the rebuild hint as a `run:` fix string.

It also creates one absorb-time workflow fallback that is easy to forget: if a local or global `almanac search`/`show` command fails because the installed `better-sqlite3` binary targets the wrong Node ABI, the checked-in wiki pages under `[[.almanac/pages/]]` are still readable as plain files. Future agents should treat that as the immediate fallback for wiki context gathering instead of assuming the wiki itself is unavailable.
