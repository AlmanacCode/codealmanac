# Markdown Page Links Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Retire authored wikilinks and derive page graph edges from normal Markdown links.

**Architecture:** Page documents own extraction from authored Markdown into page-link edges. The index stores those edges in a derived `page_links` table. Viewer rendering rewrites internal Markdown page links to SPA page routes while external links keep their normal href.

**Tech Stack:** Python 3.12, markdown-it-py, SQLite, pytest, Ruff.

---

## Read Before Coding

- `MANUAL.md`
- `implementation-tickets.md`, Ticket 4
- `almanac/architecture/wiki-tree.md`
- `almanac/architecture/indexing.md`
- `src/codealmanac/services/wiki/documents.py`
- `src/codealmanac/services/viewer/renderer.py`

## Link Rules

Authored page links are normal Markdown links:

```md
[Source provenance](decisions/source-provenance)
[Wiki tree](../architecture/wiki-tree)
```

Resolution rules:

- Page ids are paths under `almanac/` without `.md`.
- For a normal page, relative links resolve from that page's folder.
- For a folder `README.md`, relative links resolve from that folder route.
- External URLs and anchor-only links are not wiki page links.
- Repo files are not Markdown page links; file evidence belongs in `sources:`.
- Authored wikilinks are not parsed as graph edges.

## Task 1: Add Markdown Page-Link Extraction

**Files:**

- Create: `src/codealmanac/services/wiki/links.py`
- Modify: `src/codealmanac/services/wiki/documents.py`
- Modify: `src/codealmanac/services/wiki/models.py`
- Test: `tests/test_wiki_parsing.py`
- Test: `tests/test_read_model.py`

**Steps:**

1. Add a Markdown parser helper that walks inline `link_open` tokens.
2. Resolve relative hrefs against the source page id.
3. Ignore external URLs, anchor-only hrefs, paths with file extensions, and invalid `..` escapes.
4. Use the helper in `load_page_document`.
5. Remove wikilink extraction from page loading.

## Task 2: Rename Derived Link Storage

**Files:**

- Modify: `src/codealmanac/services/index/schema.py`
- Modify: `src/codealmanac/services/index/projection.py`
- Modify: `src/codealmanac/services/index/page_views.py`
- Modify: `src/codealmanac/services/index/health_graph_views.py`
- Modify: `src/codealmanac/services/index/models.py`
- Modify: `src/codealmanac/cli/render/pages.py`
- Modify: `src/codealmanac/services/viewer/service.py`

**Steps:**

1. Replace the derived `wikilinks` table with `page_links`.
2. Rename `wikilinks_in/out` model fields to `page_links_in/out`.
3. Keep CLI flags `--links` and `--backlinks`; only internal names change.
4. Keep health category name `broken_links`, but read from `page_links`.

## Task 3: Render Markdown Page Links For Viewer

**Files:**

- Modify: `src/codealmanac/services/viewer/renderer.py`
- Test: `tests/test_viewer_renderer.py`
- Test: `tests/test_viewer_service.py`
- Test: `tests/conftest.py`

**Steps:**

1. Pass the current page id into the Markdown renderer from viewer service.
2. Rewrite internal page-link hrefs to `#/page/<page-id>` during rendering.
3. Leave inline code and fenced code untouched through normal Markdown parsing.
4. Remove wikilink-specific renderer tests.

## Task 4: Update Guidance And Fixtures

**Files:**

- Modify: `src/codealmanac/prompts/base/syntax.md`
- Modify: `src/codealmanac/manual/pages.md`
- Modify: `MANUAL.md`
- Modify: `notes.md`
- Modify: `almanac/architecture/indexing.md`

**Steps:**

1. Remove wikilink guidance from active prompts and manual pages.
2. Update examples to use extensionless Markdown page links.
3. Keep historical mentions only where they describe removed legacy behavior.

## Verification

Run:

```bash
uv run pytest tests/test_wiki_parsing.py tests/test_read_model.py tests/test_topics_health.py tests/test_viewer_renderer.py tests/test_viewer_service.py tests/test_cli.py tests/test_prompts.py tests/test_public_contract.py
uv run pytest
uv run ruff check .
tmp_home=$(mktemp -d); HOME="$tmp_home" uv run codealmanac health
rg "wikilinks|\\[\\[" src/codealmanac/services/wiki src/codealmanac/services/index src/codealmanac/services/viewer src/codealmanac/prompts src/codealmanac/manual tests almanac MANUAL.md README.md AGENTS.md
```

Expected:

- Markdown page links create backlinks and broken-link health findings.
- Authored wikilinks do not create page links.
- Viewer renders Markdown page links as local page navigation.
- No active prompt/manual/parser code teaches wikilinks.
