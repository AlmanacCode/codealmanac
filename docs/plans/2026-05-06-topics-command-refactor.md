# Topics Command Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split `src/commands/topics.ts` into smaller, readable modules without changing command behavior.

**Architecture:** Keep the public `runTopicsX()` API stable for CLI registration and tests. Move one command per file under `src/commands/topics/`, keep shared option/result types in `types.ts`, and keep existing workspace/read/page-rewrite helpers. Avoid classes or a generic command framework.

**Tech Stack:** TypeScript, Commander callers, better-sqlite3, Vitest.

---

### Task 1: Extract Shared Types

**Files:**
- Create: `src/commands/topics/types.ts`
- Modify: `src/commands/topics.ts`

**Steps:**
1. Move `TopicsCommandOutput` and all `Topics*Options` interfaces into `types.ts`.
2. Re-export those types from `topics.ts` so existing imports keep working.
3. Run `npm run lint`.

### Task 2: Extract Read Commands

**Files:**
- Create: `src/commands/topics/list.ts`
- Create: `src/commands/topics/show.ts`
- Modify: `src/commands/topics.ts`

**Steps:**
1. Move `runTopicsList` unchanged into `list.ts`.
2. Move `runTopicsShow` unchanged into `show.ts`.
3. Update imports to use local helpers from `read.ts`, `workspace.ts`, and shared `types.ts`.
4. Re-export both functions from `topics.ts`.
5. Run `npm test -- test/topics.test.ts`.

### Task 3: Extract Mutation Commands

**Files:**
- Create: `src/commands/topics/create.ts`
- Create: `src/commands/topics/link.ts`
- Create: `src/commands/topics/unlink.ts`
- Create: `src/commands/topics/rename.ts`
- Create: `src/commands/topics/delete.ts`
- Create: `src/commands/topics/describe.ts`
- Modify: `src/commands/topics.ts`

**Steps:**
1. Move each mutation command into its matching file.
2. Keep workflows direct: resolve repo, validate slugs, open workspace, mutate YAML, rewrite pages if needed, reindex, return output.
3. Do not introduce a class, registry, or generic executor.
4. Re-export all functions from `topics.ts`.
5. Run `npm test -- test/topics.test.ts test/tag.test.ts test/health.test.ts`.

### Task 4: Verify Baseline

**Commands:**
- `npm run lint`
- `npm test`

**Expected:** TypeScript passes and all tests remain green.
