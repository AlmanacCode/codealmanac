# Review Escalations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo-local `almanac review` queue for unresolved wiki conflicts that humans decide and Garden later applies.

**Architecture:** Store review items in a human-readable `.almanac/review.yaml` file, separate from the SQLite index for v1. The CLI owns deterministic file updates; Garden learns to process `decided` items before normal cleanup and marks them `applied` after editing pages.

**Tech Stack:** TypeScript, Commander, `js-yaml`, Vitest, existing Almanac wiki root resolution and command result patterns.

---

### Task 1: Add Review Store

**Files:**
- Create: `src/review/store.ts`
- Test: `test/review-command.test.ts`

**Step 1: Write tests for add/list lifecycle**

Create tests that add a Markdown review item, assert `.almanac/review.yaml` exists, assert the first heading becomes the summary, and assert the generated ID is kebab-case and collision-safe.

**Step 2: Implement store helpers**

Implement:
- `loadReviewFile(path)`
- `writeReviewFile(path, file)`
- `summaryFromMarkdown(markdown)`
- `nextReviewId(summary, existingItems)`

The file should default to `{ version: 1, items: [] }`, reject malformed top-level YAML, sort items by creation order, and write atomically with a short header comment.

### Task 2: Add Review Commands

**Files:**
- Create: `src/commands/review.ts`
- Modify: `src/cli/register-edit-commands.ts`
- Test: `test/review-command.test.ts`

**Step 1: Implement command functions**

Add:
- `runReviewAdd`
- `runReviewList`
- `runReviewShow`
- `runReviewDecide`
- `runReviewApply`
- `runReviewReopen`

Statuses are `open`, `decided`, and `applied`. `decide` records a decision but does not edit pages. `apply` requires a decided item and records the edit summary. `reopen` moves any item back to open while preserving prior notes as context.

**Step 2: Register CLI commands**

Add:
- `almanac review add [markdown...]`
- `almanac review list --status <status> --json`
- `almanac review show <id> --json`
- `almanac review decide <id> [markdown...]`
- `almanac review apply <id> [markdown...]`
- `almanac review reopen <id> [markdown...]`

If no Markdown argument is supplied and stdin is piped, read stdin. If neither exists, return a clear error.

### Task 3: Teach Garden to Apply Decisions

**Files:**
- Modify: `prompts/operations/garden.md`
- Modify: `test/garden-operation.test.ts`

**Step 1: Update Garden prompt**

Before general cleanup, Garden must run `almanac review list --status decided`, inspect each decided item with `almanac review show <id>`, apply the decision to the relevant wiki pages, then mark it applied with `almanac review apply <id> "summary of edits"`.

**Step 2: Add prompt assertion**

Extend the garden operation test to assert the prompt includes the decided-review workflow commands.

### Task 4: Verify and Commit

**Files:**
- All changed files

**Step 1: Run focused tests**

Run `npm test -- review-command garden-operation`.

**Step 2: Run full verification**

Run `npm test` and `npm run build`.

**Step 3: Commit and push**

Commit with `feat: add wiki review escalations` and push `dev` after verification passes.
