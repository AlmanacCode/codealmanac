# Sources Canonical Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove legacy file-list frontmatter support and make structured `sources:` the only authored evidence model for file-aware retrieval.

**Architecture:** Frontmatter parsing owns the authored YAML contract and returns typed page metadata. Page loading derives `file_refs` from `sources[type=file]` and, until Ticket 4 lands, existing inline file wikilinks. The index remains a derived read model over `PageDocument.file_refs`.

**Tech Stack:** Python 3.12, Pydantic, python-frontmatter, SQLite, pytest, Ruff.

---

## Read Before Coding

- `MANUAL.md`
- `implementation-tickets.md`, Ticket 3
- `almanac/decisions/source-provenance.md`
- `almanac/architecture/indexing.md`
- `docs/reference/cosmic-python/chapter_02_repository.md`
- `docs/reference/cosmic-python/chapter_05_high_gear_low_gear.md`

Relevant Cosmic Python line: the repository chapter frames repositories as a way of "decoupling our core logic from infrastructural concerns"; here, the page parser owns author syntax while the index store stays a persistence projection.

## Task 1: Remove Legacy File-List Parsing

**Files:**

- Modify: `src/codealmanac/services/wiki/frontmatter.py`
- Modify: `src/codealmanac/services/wiki/models.py`
- Modify: `src/codealmanac/services/wiki/documents.py`
- Test: `tests/test_wiki_parsing.py`

**Steps:**

1. Update frontmatter parser tests so legacy file-list YAML is ignored as an unknown field.
2. Remove `files` from `ParsedFrontmatter` and `FrontmatterFields`.
3. Remove `frontmatter_file_refs(...)` and all calls to it.
4. Keep `source_file_refs(...)` as the only frontmatter-to-file-ref path.

## Task 2: Prove Mentions Use Sources

**Files:**

- Modify: `tests/test_read_model.py`

**Steps:**

1. Change mention-search tests to use `sources:` file entries, not legacy file-list frontmatter.
2. Add a regression test where a page with only legacy file-list YAML does not produce `file_refs`.
3. Keep source target fallback coverage for current accepted source shapes.

## Task 3: Update Active Guidance

**Files:**

- Modify: `MANUAL.md`
- Modify: `notes.md`
- Modify: `src/codealmanac/prompts/base/syntax.md`
- Modify: `src/codealmanac/manual/pages.md`
- Modify: `src/codealmanac/manual/sources.md`
- Modify: `almanac/decisions/source-provenance.md`
- Modify: `almanac/architecture/indexing.md`

**Steps:**

1. Remove wording that presents legacy file-list frontmatter as accepted input.
2. Keep the product rule: file evidence is represented by `sources:` entries with `type: file`.
3. Keep historical references only where they explain why legacy behavior was removed.

## Verification

Run:

```bash
uv run pytest tests/test_wiki_parsing.py tests/test_read_model.py tests/test_public_contract.py tests/test_prompts.py
uv run pytest
uv run ruff check .
tmp_home=$(mktemp -d); HOME="$tmp_home" uv run codealmanac health
rg "frontmatter\\.files|frontmatter_file_refs|^[[:space:]]*files:" src/codealmanac/services/wiki tests README.md AGENTS.md MANUAL.md almanac
```

Expected:

- Tests pass.
- Ruff passes.
- Health is clean.
- No active parser/test/docs path teaches or uses legacy file-list frontmatter.
