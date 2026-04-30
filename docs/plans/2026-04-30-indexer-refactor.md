# Indexer Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the indexer easier to scan by extracting freshness checks and `topics.yaml` reconciliation from the page indexing transaction.

**Architecture:** Keep `src/indexer/index.ts` responsible for `ensureFreshIndex`, `runIndexer`, page scanning, and page-row writes. Move mtime freshness helpers into `src/indexer/freshness.ts` and topic DAG reconciliation into `src/indexer/topicsYaml.ts`. Do not change SQLite schema or page indexing behavior.

**Tech Stack:** TypeScript, fast-glob, better-sqlite3, Vitest.

---

### Task 1: Extract Freshness Helpers

**Files:**
- Create: `src/indexer/freshness.ts`
- Modify: `src/indexer/index.ts`

**Steps:**
1. Move `PAGES_GLOB`, `pagesNewerThan`, and `topicsYamlNewerThan` into `freshness.ts`.
2. Keep `ensureFreshIndex` in `index.ts` so the public API stays stable.
3. Run `npm run lint`.

### Task 2: Extract Topics YAML Reconciliation

**Files:**
- Create: `src/indexer/topicsYaml.ts`
- Modify: `src/indexer/index.ts`

**Steps:**
1. Move `TOPICS_YAML_FILENAME` and `applyTopicsYaml` into `topicsYaml.ts`.
2. Preserve malformed YAML warning behavior.
3. Keep page transaction code in `index.ts`.
4. Run focused indexer/search/topics/health tests.

### Task 3: Verify Full Baseline

**Commands:**
- `npm test`
- `npm run lint`
- `npm run build`

**Expected:** All tests and build pass with no user-visible behavior change.
