# Global Viewer Directory Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `almanac serve` a cwd-independent local wiki browser that opens an all-wikis directory and lets users browse any reachable registered wiki.

**Architecture:** Keep each repo wiki sovereign and keep each wiki's existing viewer API as the per-repo primitive. Add a thin global viewer layer that reads `~/.almanac/registry.json`, filters reachable entries, and dispatches wiki-scoped API requests to `createViewerApi({ repoRoot })`. The frontend becomes two modes in one shell: a global directory at `/`, and the existing wiki viewer under `/w/:wiki`.

**Tech Stack:** Node `http`, existing registry helpers, existing `better-sqlite3` index, plain browser JavaScript/CSS static viewer assets, Vitest.

---

## Read Before Coding

- `docs/bugs/codebase-wiki.md` for the current product contract, especially local-only storage, registry semantics, and cross-wiki references.
- `docs/plans/2026-05-10-local-viewer.md` for the existing viewer design and scope.
- `src/paths.ts` for the registry path contract.
- `src/registry/index.ts` and `src/commands/list.ts` for registry read/filter behavior.
- `src/viewer/api.ts`, `src/viewer/server.ts`, `viewer/app.js`, `viewer/app.css`, `viewer/search-suggestions.js`, and `viewer/jobs-view.js` for the current single-wiki viewer.

## Non-Goals

- No cwd-specific behavior. `almanac serve` behaves the same from any directory.
- No "current wiki" pinning, highlighting, or auto-redirect.
- No global full-text search across all wikis in this slice.
- No editing UI.
- No hosted service, shared database, or central merged index.
- No new frontend build step or framework.

## Design Decisions

1. `/` is always the all-wikis directory.
2. Wiki routes live under `/w/:wikiName`.
3. API routes mirror the UI namespace:
   - `GET /api/wikis`
   - `GET /api/wikis/:wiki/overview`
   - `GET /api/wikis/:wiki/page/:slug`
   - `GET /api/wikis/:wiki/topic/:slug`
   - `GET /api/wikis/:wiki/search?q=...`
   - `GET /api/wikis/:wiki/suggest?q=...`
   - `GET /api/wikis/:wiki/file?path=...`
   - `GET /api/wikis/:wiki/jobs`
   - `GET /api/wikis/:wiki/jobs/:runId`
4. The old single-wiki API paths may remain as internal compatibility only if tests or existing code need them, but the browser UI should use the new wiki-scoped paths.
5. Unreachable registry entries are omitted from `/api/wikis`, matching `almanac list`.
6. A registry entry is browseable only when `entry.path/.almanac` exists. A path that exists but is not a wiki should not appear in the directory.
7. Malformed registry JSON should surface as a server error. Do not silently erase or repair it.

## Desired UI Shape

The homepage should reuse the current visual language: warm paper palette, serif type, restrained borders, and the existing panel/list patterns. It should feel like a library index, not a landing page.

Directory cards show:

- wiki name
- description, or a quiet fallback
- repo path
- page count and topic count, loaded from that wiki's overview

Inside `/w/:wiki`, the existing viewer should feel almost unchanged. The left rail keeps the brand, search, nav, jobs, and topics. Add only a small "All wikis" route near the top or brand area so users can return to `/`. Do not add a global picker unless later usage proves it is needed.

## Task 1: Add A Global Viewer API

**Files:**
- Create: `src/viewer/global-api.ts`
- Modify: `src/viewer/api.ts` only if a shared type export is needed
- Test: `test/viewer-global-api.test.ts`

**Steps:**
1. Write a failing test using `withTempHome`, two repos, `scaffoldWiki`, `writePage`, and `addEntry`.
2. Test that `listWikis()` returns only entries whose `path/.almanac` exists.
3. Test that list rows include `name`, `description`, `path`, `pageCount`, `topicCount`, and maybe recent-page metadata needed by the directory.
4. Test that unreachable paths and non-wiki paths are skipped but remain in the registry.
5. Implement `createGlobalViewerApi()` with:
   - `wikis(): Promise<{ wikis: ViewerWikiSummary[] }>`
   - `forWiki(name): Promise<ViewerApi>`
6. Internally read the registry once per request and resolve the named entry exactly. Do not cache repo roots in module state.
7. Use `createViewerApi({ repoRoot: entry.path })` after validating `entry.path/.almanac`.
8. Run `npm test -- viewer-global-api.test.ts`.

## Task 2: Make The Server Wiki-Scoped

**Files:**
- Modify: `src/viewer/server.ts`
- Modify: `src/commands/serve.ts`
- Modify: `src/cli/register-query-commands.ts`
- Test: `test/serve-command.test.ts`

**Steps:**
1. Change `ViewerServerOptions` so `repoRoot` is no longer required.
2. Change `runServe` so it does not call `resolveWikiRoot`.
3. Keep `host` and `port` behavior unchanged.
4. Add `/api/wikis` route.
5. Add `/api/wikis/:wiki/...` route parsing.
6. Dispatch each wiki-scoped route to `createGlobalViewerApi().forWiki(wiki)`.
7. Return `404` JSON for unknown wiki names and page/topic/job misses.
8. Preserve static fallback behavior for client-side routes.
9. Update tests to start the server without `repoRoot`.
10. Add a server test that fetches `/api/wikis`, `/api/wikis/alpha/overview`, and `/api/wikis/beta/page/<slug>`.
11. Run `npm test -- serve-command.test.ts viewer-global-api.test.ts`.

## Task 3: Refactor Frontend Routing Around A Wiki Context

**Files:**
- Modify: `viewer/app.js`
- Modify: `viewer/search-suggestions.js`
- Modify: `viewer/jobs-view.js`
- Test: `test/viewer-ui-assets.test.ts`

**Steps:**
1. Add `state.wikis`, `state.currentWiki`, and keep `state.overview` as the selected wiki overview.
2. Add helpers:
   - `wikiBase() -> /w/:wiki`
   - `wikiRoute(path) -> /w/:wiki + path`
   - `wikiApi(path) -> /api/wikis/:wiki + path`
3. Update `boot()` to fetch `/api/wikis` first.
4. Route `/` to `renderWikiDirectory()`.
5. Route `/w/:wiki` to the existing overview renderer after loading that wiki's overview.
6. Route `/w/:wiki/page/:slug`, `/topic/:slug`, `/search`, `/file`, `/jobs`, and `/jobs/:runId` through the selected wiki context.
7. Refactor existing render functions to call `wikiRoute(...)` for links and `wikiApi(...)` for API calls.
8. Change search suggestions to accept an API path builder or let the parent pass a scoped `api` function.
9. Change jobs view so links and polling compare against `/w/:wiki/jobs/:runId`.
10. Keep all DOM ownership in `app.js`; do not create a second app or duplicate page rendering logic.
11. Run `npm test -- viewer-ui-assets.test.ts`.

## Task 4: Build The Directory UI With Existing Design Primitives

**Files:**
- Modify: `viewer/app.js`
- Modify: `viewer/app.css`
- Modify: `viewer/index.html` only if structural hooks are needed

**Steps:**
1. Implement `renderWikiDirectory()`.
2. Reuse `.ca-hero`, `.ca-grid`, `.ca-panel`, `.ca-page-list`, and `.ca-page-row` where possible.
3. Add small, specific classes only where directory layout needs them, for example `.ca-wiki-directory`, `.ca-wiki-row`, `.ca-wiki-stats`.
4. Empty state copy should be direct: no wikis registered, run `almanac init` in a repo.
5. On the directory page, hide the right rail.
6. On the directory page, hide wiki-specific topics and search or disable them cleanly. Prefer a simple global directory shell over a half-working global search.
7. Inside a wiki, show the existing search/nav/topics behavior.
8. Add one "All wikis" nav item that routes to `/`.
9. Run the viewer manually and inspect both empty and populated states.

## Task 5: Cross-Wiki Links Become Local Navigation

**Files:**
- Modify: `viewer/app.js`
- Test: `test/viewer-ui-assets.test.ts`

**Steps:**
1. Update `inline()` wikilink rendering.
2. Preserve current file detection: links containing `/` are file references unless they are cross-wiki refs.
3. Detect cross-wiki refs by `:` before any `/`, matching the indexer contract.
4. Render `[[other-wiki:slug]]` as `/w/other-wiki/page/slug`.
5. Render normal page links as `/w/current-wiki/page/slug`.
6. Render file links as `/w/current-wiki/file?path=...`.
7. Do not preflight whether the target wiki/page exists from the renderer. Let navigation show a normal 404/error if missing.
8. Add asset tests that assert the classifier order is present in `viewer/app.js`.
9. Run `npm test -- viewer-ui-assets.test.ts`.

## Task 6: End-To-End Verification

**Files:**
- Existing files only

**Steps:**
1. Run focused tests:
   - `npm test -- viewer-global-api.test.ts serve-command.test.ts viewer-api.test.ts viewer-ui-assets.test.ts`
2. Run full test suite:
   - `npm test`
3. Run build:
   - `npm run build`
4. Start the built CLI:
   - `node dist/bin/codealmanac.js serve --port 3927`
5. Open the printed URL.
6. Verify `/` shows the all-wikis directory.
7. Verify clicking each wiki opens `/w/:wiki`.
8. Verify overview, page, topic, search, file, and jobs routes work inside a wiki.
9. Verify `almanac serve` from outside any repo behaves identically.

## Commit

After implementation and verification:

```bash
git add src/viewer src/commands/serve.ts src/cli/register-query-commands.ts viewer test docs/plans/2026-05-11-global-viewer-directory.md
git commit -m "feat(viewer): add global wiki directory"
```

