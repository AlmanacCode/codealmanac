# Viewer Jobs Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only jobs dashboard to `almanac serve` that lists recent runs, shows run settings/status, and renders the normalized JSONL stream with lightweight live polling.

**Architecture:** Extend the existing local viewer API over `.almanac/runs/*.json` and `.jsonl`; keep run storage unchanged. Add vanilla JS routes for `/jobs` and `/jobs/:runId`, using periodic polling while a run is queued or running.

**Tech Stack:** TypeScript, Node `http`, existing process record helpers, vanilla `viewer/app.js`, CSS in `viewer/app.css`, Vitest.

---

### Task 1: Add Read-Only Jobs API

**Files:**
- Modify: `src/viewer/api.ts`
- Modify: `src/viewer/server.ts`
- Test: `test/viewer-api.test.ts`

**Steps:**
1. Add `jobs()` to `ViewerApi`, returning `RunView[]` using `listRunRecords()` and `toRunView()`.
2. Add `job(runId)` to `ViewerApi`, returning one `RunView` plus parsed JSONL events.
3. Parse logs line-by-line, skipping blank lines and preserving invalid lines as error-shaped display rows instead of throwing the whole request.
4. Add `/api/jobs` and `/api/jobs/:runId` routes in `server.ts`.
5. Test list/detail against temporary `.almanac/runs/` records and logs.

### Task 2: Add Viewer Jobs UI

**Files:**
- Modify: `viewer/index.html`
- Modify: `viewer/app.js`
- Modify: `viewer/app.css`
- Test: `test/viewer-ui-assets.test.ts`

**Steps:**
1. Add a left-nav `Jobs` item.
2. Route `/jobs` to a dashboard with status summary, operation/provider/model metadata, elapsed time, and recent run rows.
3. Route `/jobs/:runId` to a detail page with settings, status, page-change summary, failure info, and a stream timeline.
4. Poll `/api/jobs/:runId` while status is `queued` or `running`; stop polling on terminal or stale states.
5. Keep the page rail hidden for job routes.

### Task 3: Verify

**Commands:**
- `npm test -- viewer-api viewer-ui-assets`
- `npm test`

**Expected:** Focused tests pass first, then the full Vitest suite is green.
