# Search Result Summaries Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one-sentence wiki page summaries and show them in `almanac search` results.

**Architecture:** Parse an optional `summary` frontmatter field into the SQLite `pages` table, expose it through search/show JSON, and render summaries for scan-friendly search output. Preserve pipe-friendly slug-only output with `--slugs` and make explicit summary output available with `--summaries`.

**Tech Stack:** TypeScript, commander, better-sqlite3, Vitest.

---

### Task 1: Index `summary` metadata

**Files:**
- Modify: `src/indexer/frontmatter.ts`
- Modify: `src/indexer/schema.ts`
- Modify: `src/indexer/index.ts`
- Test: `test/frontmatter.test.ts`

**Steps:**
1. Add `summary?: string` to `Frontmatter` and coerce `summary` as a trimmed string.
2. Add nullable `summary` to `pages`.
3. Bump `SCHEMA_VERSION` and migrate older DBs with `ALTER TABLE pages ADD COLUMN summary TEXT`, clearing `content_hash` so summaries are populated on next reindex.
4. Persist `summary` in page upserts.
5. Add/extend tests for summary parsing and indexing through query/show surfaces.

### Task 2: Render summaries in search/show

**Files:**
- Modify: `src/commands/search.ts`
- Modify: `src/commands/show.ts`
- Modify: `src/cli/register-query-commands.ts`
- Test: `test/search.test.ts`
- Test: `test/show.test.ts`

**Steps:**
1. Add `summary` to search rows and JSON output.
2. Render summary search output as `slug` followed by indented summary when present.
3. Add `--slugs` to keep old one-slug-per-line output and `--summaries` to force summary output.
4. Add `summary` to `ShowRecord` and default metadata header.
5. Add tests for default search summaries, `--slugs`, JSON output, and show JSON/header.

### Task 3: Prompt convention

**Files:**
- Modify: `prompts/base/syntax.md`

**Steps:**
1. Document `summary` as a current tooling field.
2. Tell agents to keep it to one direct sentence that explains what the page is for.

### Task 4: Verify and ship

**Commands:**
- `npm test`
- `npm run lint`
- `npm run build`

**Commit:**
- `feat: add search result summaries`
