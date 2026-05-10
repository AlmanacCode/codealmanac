# Local Viewer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `almanac serve`, a local read-only web viewer for browsing a repo's CodeAlmanac wiki.

**Architecture:** The viewer is a thin HTTP layer over the existing SQLite index and markdown page files. Markdown remains canonical; the server only reads files, triggers silent reindex, and serves JSON plus static bundled UI assets. The first slice keeps editing out of scope and exposes "open/reveal path" data for the frontend to display.

**Tech Stack:** Node `http`, existing `better-sqlite3` index, existing `.almanac/pages` storage, plain browser JavaScript/CSS static assets bundled in the npm package.

---

### Task 1: Shared Page Query

**Files:**
- Create: `src/query/page-view.ts`
- Modify: `src/commands/show.ts`
- Test: `test/viewer-query.test.ts`

**Steps:**
1. Extract the DB/page-content record fetch from `src/commands/show.ts` into `getPageView(db, slug)`.
2. Export a `PageView` type matching the existing `ShowRecord` shape.
3. Update `runShow` to call `getPageView` so CLI behavior and viewer data share one implementation.
4. Add a test that indexes a page and verifies body, topics, file refs, outgoing links, and backlinks.
5. Run `npm test -- viewer-query.test.ts show.test.ts`.

### Task 2: Viewer API

**Files:**
- Create: `src/viewer/api.ts`
- Test: `test/viewer-api.test.ts`

**Steps:**
1. Add `createViewerApi({ repoRoot })`.
2. Add `overview()` returning wiki title, page count, topic count, recent pages, and root topics.
3. Add `page(slug)` returning a `PageView` or `null`.
4. Add `topic(slug)` returning topic metadata, parents, children, and active pages.
5. Add `search(query)` returning active page summaries from FTS when query is present, otherwise recent pages.
6. Add `file(path)` returning pages from `file_refs` using the same path matching semantics as `search --mentions`.
7. Run `npm test -- viewer-api.test.ts`.

### Task 3: Local Server

**Files:**
- Create: `src/commands/serve.ts`
- Create: `src/viewer/server.ts`
- Create: `src/viewer/static.ts`
- Modify: `src/cli/register-query-commands.ts`
- Test: `test/serve-command.test.ts`

**Steps:**
1. Implement `startViewerServer({ repoRoot, host, port })`.
2. Serve `/api/overview`, `/api/page/:slug`, `/api/topic/:slug`, `/api/search`, and `/api/file`.
3. Serve static viewer assets for all non-API routes so client-side navigation works.
4. Implement port `0` support for tests and default `3927` for CLI use.
5. Add `runServe({ cwd, host, port, open })` as the command wrapper.
6. Register `almanac serve --port <n> --host <host>`.
7. Add tests for JSON route behavior and command output.

### Task 4: Static Viewer UI

**Files:**
- Create: `viewer/index.html`
- Create: `viewer/app.js`
- Create: `viewer/app.css`
- Modify: `package.json`

**Steps:**
1. Build a three-column shell: left navigation/search, central reader, right metadata rail.
2. Use an OpenAlmanac-inspired warm paper palette and serif article typography.
3. Render markdown headings, paragraphs, lists, code blocks, inline code, links, and `[[wikilinks]]`.
4. Add page/topic/search/file navigation without a frontend build step.
5. Add `viewer` to package `files`.

### Task 5: Verification

**Files:**
- Existing repo files only.

**Steps:**
1. Run focused tests for query, API, serve, show.
2. Run `npm run lint`.
3. Run `npm test`.
4. Run `npm run build`.
5. Start `almanac serve --port 0` through the test harness or built CLI path if needed.
