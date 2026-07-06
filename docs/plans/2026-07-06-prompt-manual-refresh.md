# Prompt Manual Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring over the newer prompt/manual doctrine while preserving the local-first Python product contract.

**Architecture:** Prompts and manuals stay packaged resources under `src/codealmanac/prompts/` and `src/codealmanac/manual/`. The renderer still composes named sections; lifecycle workflows pass runtime context as they do today. No compatibility aliases are added for retired prompt section names.

**Tech Stack:** Python package resources via `importlib.resources`, Pydantic request/value models, pytest contract tests.

---

### Task 1: Replace The Base Prompt With A Local-First Kernel

**Files:**
- Create: `src/codealmanac/prompts/base/kernel.md`
- Modify: `src/codealmanac/prompts/models.py`
- Modify: `src/codealmanac/workflows/ingest/service.py`
- Modify: `src/codealmanac/workflows/garden/service.py`
- Delete: `src/codealmanac/prompts/base/purpose.md`
- Delete: `src/codealmanac/prompts/base/notability.md`
- Delete: `src/codealmanac/prompts/base/syntax.md`
- Test: `tests/test_prompts.py`

**Steps:**

1. Update prompt tests to expect `PromptName.BASE_KERNEL`.
2. Add `base/kernel.md` from the newer prompt work, rewritten for:
   - CLI name `codealmanac`
   - only `almanac/`
   - nested Markdown page tree
   - path-first page ids
   - normal Markdown page links
   - `sources:` only
   - no `pages/`
   - no `[[...]]`
   - packaged manual resources, not repo-local `almanac/manual/`
3. Update ingest/garden prompt section tuples to use the kernel plus the operation prompt.
4. Remove retired base prompt files and enum values.
5. Run `uv run pytest tests/test_prompts.py`.

### Task 2: Refresh Operation Prompts

**Files:**
- Modify: `src/codealmanac/prompts/operations/ingest.md`
- Modify: `src/codealmanac/prompts/operations/garden.md`
- Test: `tests/test_prompts.py`

**Steps:**

1. Bring over the stronger algorithmic shape from `dev`.
2. Rewrite local product details:
   - read bundled manual concepts from the prompt context/product rules, not `manual/` under the wiki
   - write only under `almanac/`
   - use Markdown links and `sources:`
   - run `codealmanac validate`
3. Keep the prompt concise enough for lifecycle runs.
4. Add tests that reject `[[`, `pages/`, `.almanac/`, and `docs/almanac/` in packaged prompts.

### Task 3: Refresh The Bundled Manual

**Files:**
- Modify: `src/codealmanac/manual/models.py`
- Modify: `src/codealmanac/manual/README.md`
- Modify: `src/codealmanac/manual/evidence.md`
- Modify: `src/codealmanac/manual/sources.md`
- Modify: `src/codealmanac/manual/ingest.md`
- Modify: `src/codealmanac/manual/garden.md`
- Create: `src/codealmanac/manual/concepts.md`
- Create: `src/codealmanac/manual/architecture.md`
- Create: `src/codealmanac/manual/how-to-guides.md`
- Create: `src/codealmanac/manual/decisions.md`
- Create: `src/codealmanac/manual/reference.md`
- Create: `src/codealmanac/manual/how-to-write.md`
- Create: `src/codealmanac/manual/links.md`
- Create: `src/codealmanac/manual/topics.md`
- Delete: `src/codealmanac/manual/pages.md`
- Delete: `src/codealmanac/manual/style.md`
- Delete: `src/codealmanac/manual/build.md`
- Test: `tests/test_manual.py`

**Steps:**

1. Update `ManualDocumentName` and `MANUAL_DOCUMENTS` to the new document set.
2. Rewrite the imported manual pages for the current tree:
   - folder examples use `almanac/concepts/`, `almanac/architecture/`, `almanac/guides/`, `almanac/decisions/`, and `almanac/reference/`
   - no `pages/`
   - no configured alternate root
   - no repo-local `manual/`
   - no double-bracket links
3. Update tests to expect the new document inventory and local-first text.
4. Run `uv run pytest tests/test_manual.py`.

### Task 4: Verify Public Contract And Package Resource Hygiene

**Files:**
- Modify as needed: `src/codealmanac/services/setup/agent-guide.md`
- Modify as needed: docs that reference old prompt/manual names
- Test: `tests/test_public_contract.py`
- Test: `tests/test_cli.py`

**Steps:**

1. Scan prompt/manual/setup resources for retired strings.
2. Run `uv run pytest tests/test_public_contract.py tests/test_prompts.py tests/test_manual.py`.
3. Run `uv run ruff check .`.
4. Run `uv run pytest`.
5. Run `uv run codealmanac validate`.
6. Commit as `feat(ticket-7): refresh prompts and manual`.
