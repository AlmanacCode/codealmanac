---
title: almanac serve (Local Viewer)
summary: "`almanac serve` is a local read-only viewer over wiki pages, the SQLite index, and run records, including a jobs dashboard."
topics: [cli, decisions, systems]
status: active
verified: 2026-05-15
files:
  - src/commands/serve.ts
  - src/viewer/api.ts
  - src/viewer/jobs.ts
  - src/viewer/server.ts
  - src/viewer/static.ts
  - src/query/page-view.ts
  - viewer/index.html
  - viewer/almanac-logo.png
  - viewer/app.js
  - viewer/app.css
  - viewer/routes.js
  - viewer/jobs-view.js
  - viewer/jobs-transcript.js
  - viewer/jobs.css
  - viewer/search-suggestions.js
  - test/serve-command.test.ts
  - test/viewer-api.test.ts
  - test/viewer-jobs-transcript.test.ts
  - test/viewer-ui-assets.test.ts
sources:
  - docs/plans/2026-05-10-local-viewer.md
  - docs/plans/2026-05-10-viewer-jobs-dashboard.md
  - docs/plans/2026-05-11-jobs-stream-ui-garden.md
  - ../openalmanac/frontend/src/components/wiki/wiki-theme.css
  - ../openalmanac/frontend/src/components/wiki/wiki-chrome.css
  - ../openalmanac/frontend/src/components/wiki/vintage-prose.css
  - ../openalmanac/frontend/src/components/wiki/layout/WikiLayout.tsx
  - ../usealmanac/index.html
  - ../usealmanac/logo1.png
---

# almanac serve (Local Viewer)

`almanac serve` is a lightweight local read-only web viewer for browsing a repo's Almanac wiki. It is the preferred "read the wiki" experience for humans — filesystem browsing and `browse/` pages are the fallback and editor interface, not the primary UX. Designed and implemented 2026-05-10.

The viewer is mostly a read-only client over existing wiki/index/run-record primitives, but a 2026-05-15 codebase-smell review found one current drift point: `[[src/viewer/api.ts]]` has its own FTS query builders, file-reference SQL, parent-folder prefix calculation, and GLOB escaping. Those rules overlap with CLI search semantics and are historically subtle. Future work should extract shared query helpers for submitted FTS queries, suggestion-prefix FTS queries, and file-reference matching instead of letting the viewer and CLI evolve separate path/search behavior.

## Rationale

A wiki graph is awkward to inspect as files. You want backlinks, topic pages, file references, archive state, search, and "what should I read next?" rendered and linked — not raw markdown in a file tree. A folder tree cannot show this well even with `browse/` curation pages.

The answer is a local viewer rather than a cloud app, hosted service, or complex editing tool. Markdown stays the source of truth; the viewer is disposable.

## Invocation

```bash
almanac serve
```

Opens at:

```text
http://localhost:3927
```

The viewer reads `.almanac/pages/*.md` and `.almanac/index.db`. It triggers an implicit reindex (same as other query commands) so the index is fresh.

## Routes

```text
/                          overview / wiki homepage
/page/:slug                rendered page with backlinks sidebar
/topic/:slug               topic + descendant pages list
/search?q=...              FTS search results
/file?path=src/foo.ts      pages mentioning a file
/jobs                      jobs dashboard — list of recent runs
/jobs/:runId               job detail — settings, status, stream timeline
```

The left-rail search box uses `/api/suggest` while typing, then `/search?q=...` for submitted searches. Suggestions are bounded to the top eight pages and reuse the same FTS path as search.

The page rail (left and right panels) is hidden for `/jobs` and `/jobs/:runId` routes — these views use a dedicated full-width layout rather than the three-panel wiki layout.

## What the viewer provides

- Page reading with rendered markdown
- Wikilinks clickable (navigate within viewer)
- Full-text search
- Instant page suggestions in the left-rail search box
- Topic browser
- Backlinks panel per page
- File reference listings (pages mentioning a given source file)
- Archive / superseded indicators
- Jobs dashboard with run list and detail/stream view
- Graph sidebar (deferred)
- Future [[wiki-clarifications]] view for human answers to unresolved questions raised by lifecycle agents

## What the viewer does not do

- No authentication
- No cloud sync or remote access
- No editing UI (markdown stays in editor/filesystem)
- No AI calls
- No database writes (except implicit reindex)
- No separate content model

## Packaging architecture

The viewer is a small static bundle shipped inside the npm package. The CLI serves it directly from the package install path via `src/viewer/static.ts`, which walks up from `__dirname` to find the package root and reads `viewer/*.{html,js,css}` directly. No separate `npm install` step.

```text
codealmanac package:
  viewer/
    index.html           # links app.css and app.js
    app.css              # served CSS: --ca-* tokens, wiki layout
    app.js               # router and chrome glue; wiki views inline
    routes.js            # wiki route helpers and wikilink route classification
    jobs-view.js         # jobs dashboard and detail view rendering
    jobs-transcript.js   # pure projection of JSONL events into chat/tool transcript rows
    jobs.css             # jobs-specific CSS
    search-suggestions.js # debounced left-rail search suggestions

almanac serve:
  Node http.createServer (no Express)
  serves viewer/ as static assets
  JSON API backed by index.db + markdown files
```

Next.js was explicitly rejected as too heavy. Express was not added; Node's `http` module is sufficient for a local read-only viewer. React and Preact were not used; the frontend is vanilla JS with a thin `h()` helper (inline in `viewer/app.js`) for building DOM nodes without a framework.

## Source module structure

The viewer is a read-only client over the same persisted index and page/run-record source files that the CLI uses. It should not introduce a separate database model or forked parser. Its current query-helper duplication in `[[src/viewer/api.ts]]` is cleanup debt, not the desired architecture.

Actual source layout:

```text
src/
  commands/
    serve.ts          # thin CLI wrapper: resolve wiki root, start server, wait for Ctrl+C

  viewer/
    api.ts            # createViewerApi(): overview(), page(), topic(), search(), suggest(), file(), jobs(), job()
    jobs.ts           # jobs API logic: listViewerJobs(), getViewerJob(), display title/subtitle,
                      #   JSONL parsing, isSafeRunId(), isPidAlive()
    server.ts         # startViewerServer(): HTTP routing for /api/* and static assets
    static.ts         # readViewerAsset() / readViewerIndex(): serves viewer/ from package root

  query/
    page-view.ts      # getPageView(db, slug) → PageView; shared by show command and viewer API

viewer/               # bundled static frontend (no build step required at runtime)
  index.html
  app.js              # router and chrome glue; wiki views (home, page, topic, search, file) inline
  routes.js           # shared route helpers for wiki-scoped URLs and wikilinks
  app.css             # all wiki tokens and layout CSS
  jobs-view.js        # jobs list and job detail UI rendering (loaded by index.html alongside app.js)
  jobs-transcript.js  # pure transcript projection and tool-card display model
  jobs.css            # jobs-specific CSS (loaded by index.html)
  search-suggestions.js # left-rail search suggestion controller
```

`serve.ts` owns only the CLI interface. `server.ts` owns HTTP. `api.ts` owns wiki-API payload assembly and delegates jobs concerns to `src/viewer/jobs.ts`. `jobs.ts` owns all run-record concerns: storage access, display title/subtitle derivation, JSONL log parsing, run-id validation, and PID liveness. `page-view.ts` is extracted shared logic: the `show` command and viewer API both call it. The frontend in `viewer/` is plain HTML + vanilla JS with no compile step. `app.js` handles routing and wiki views; `jobs-view.js` handles jobs rendering; `jobs-transcript.js` handles stream projection and tool/result pairing; `search-suggestions.js` owns the debounced search suggestion interaction.

`jobs.ts` delegates to `src/process/index.ts` — specifically `listRunRecords()`, `readRunRecord()`, `runRecordPath()`, `runLogPath()`, and `toRunView()` — for all run storage access. The viewer does not duplicate the storage rules or introduce its own process model.

## Key API types

`ViewerApi` exposes eight methods: `overview()` (wiki stats + recent pages + root topics), `page(slug)` (full `PageView` including body markdown, backlinks, topics, file refs, and a `related_pages` array), `topic(slug)` (topic metadata + children + pages), `search(query)` (FTS results or recent pages when query is empty), `suggest(query)` (top eight FTS page hits for instant suggestions), `file(path)` (pages from `file_refs` matching path semantics), `jobs()` (list of all run records as `ViewerJobRun[]`), and `job(runId)` (one `ViewerJobRun` plus its JSONL event log).

`search()` and `suggest()` use different FTS query builders. `search()` calls `buildFtsQuery()`, which wraps each whitespace-split term in exact-phrase quotes (`"term"`) and ANDs them — suitable for complete submitted queries. `suggest()` calls `buildFtsPrefixQuery()`, which appends `*` to each quoted term (`"term"*`) — FTS5 prefix matching that returns results while the user is still typing. Using `buildFtsQuery` for suggest would break as-you-type completion because incomplete words would not match their eventual full form.

`PageView` is defined in `src/query/page-view.ts` and includes: slug, title, summary, file\_path, updated\_at, archived\_at, superseded\_by, supersedes, topics, file\_refs, wikilinks\_out, wikilinks\_in, cross\_wiki\_links, and body (raw markdown). When returned by the viewer API `page()` method, a `related_pages` field is appended — page summaries for all wikilinks\_in, wikilinks\_out, and supersedes/superseded\_by targets, deduplicated, for the frontend to render titles without extra fetches.

`ViewerJobRun` extends `RunView` (from [[process-manager-runs]] via `toRunView()`) with display fields: `displayTitle` (human label derived from operation and target kind), `displaySubtitle` (nullable summary derived from the final `done`/`text` event in the log, falling back to the first target path or the model string), and `transcriptSource` for session captures. The transcript-source field intentionally differs from `provider`: a Claude or Codex transcript may be processed by a Codex, Claude, or future provider agent. `src/viewer/jobs.ts` derives the source from the run spec's capture context when available and falls back to transcript-path conventions for older records. The `enrichRunView()` helper computes these fields after parsing the event log. Run IDs are validated by `isSafeRunId()` (regex `/^run_[A-Za-z0-9_-]+$/`) before any path construction to prevent path traversal.

`ViewerJobDetail` is the shape returned by `job(runId)`: `{ run: ViewerJobRun; events: ViewerJobLogEvent[] }`. `ViewerJobLogEvent` is a discriminated union: a valid line is `{ line: number; timestamp: string | null; event: HarnessEvent }` and an unparseable line is `{ line: number; invalid: true; raw: string; error: string }`. The `readJobLogEvents()` helper reads the JSONL log file line-by-line, unwraps the process-manager `{ timestamp, event }` envelope, skips blank lines, and preserves invalid lines as error-shaped display rows rather than throwing. This is intentional: a corrupt or truncated log should still render the rest of the timeline.

Process liveness for `jobs()` is checked via `isPidAlive(pid)` — a local helper that calls `process.kill(pid, 0)` and returns `false` on any signal error. This is the same strategy `jobs attach` uses in the CLI.

## Jobs dashboard UI

The jobs dashboard (`/jobs`) lists all run records in reverse-chronological order. Each row shows: operation badge, provider/model, optional transcript source for session captures, `displayStatus` badge (colored by status), `displayTitle`, `displaySubtitle` (page-change summary if available), and elapsed time. Clicking any row navigates to `/jobs/:runId`.

The job detail view (`/jobs/:runId`) renders two fact panels followed by a stream timeline:

- **Settings panel**: operation, provider, model, started-at timestamp, finished-at timestamp, and provider session ID if present.
- **Outcomes panel**: pages created/updated/archived counts, cost (USD), token count, log file path, failure message and fix suggestion if present, error string if present.
- **Targets section**: display of the run's targets (populated from `RunView.targetPaths`).
- **Stream timeline**: assistant text renders as chat bubbles; Normal mode groups root tool calls into collapsed activity summaries; Debug mode renders individual tool cards; tool results are paired with their tool call by ID where possible; invalid lines render as error rows showing the raw content and parse error.

The desired Normal-mode hierarchy for a job detail page is outcome-first, not colophon-first. The first screen should answer: which model ran, whether it succeeded, elapsed time, what pages were created or modified, what input transcript/file/folder the run ingested, and whether that input can be opened for inspection. Page-change rows are the primary result object and should link to the affected pages when possible. Started and finished timestamps are useful but secondary. Provider session IDs, raw log paths, and other audit fields belong below the primary summary or in Debug-oriented detail because they do not answer the normal "what happened in this run?" question. The separate barometer/colophon treatment should not remain always-visible in Normal mode when it repeats status, provider, token, and path facts already present in the summary. Usage should show token count when available and a cost estimate when the run record has enough pricing data; if the estimate is not available, the UI may show an explicit "coming soon" placeholder rather than pretending token count alone is spend.

`viewer/jobs-transcript.js` is a projection layer over raw JSONL events, not a one-row-per-log-line renderer. The transcript has two modes. **Normal** is the default and suppresses `tool_summary` and `context_usage` bookkeeping events because those records duplicate information already visible in tool cards or outcome metrics and made real capture runs unreadable. **Debug** is opt-in and keeps those bookkeeping rows for provider inspection. The transcript count in `viewer/jobs-view.js` uses the projected entry count for the active mode rather than the raw `ViewerJobDetail.events.length` so the UI label matches what the user can inspect.

Expanded tool cards use mode-specific rendering. Normal mode shows tool-shaped details first: shell commands show command/output, read/write/edit calls show path and content/change/result, search calls show query/result, and agent calls show task/result. Debug mode keeps the generic fact grid plus raw JSON input/result sections so adapter behavior can still be audited.

Normal mode treats the root agent as the implicit narrator. Root assistant rows omit the `M` avatar, root tool rows omit the `Main` pill, and the standalone Agents section is hidden when the run has no helper or unknown actors. Helper and unknown actors stay labeled in Normal mode so subagent work is visible when it appears. Debug mode shows all actor labels, including root, for attribution audits.

Normal mode is organized around readable run narrative, not a timestamped event stream. `viewer/jobs-view.js` applies `groupNormalTranscript()` after `buildTranscript()` so contiguous root tool entries collapse into expandable activity summaries such as "Explored 2 files, ran 4 commands" or "Edited 2 files." Expanding a root activity summary shows compact action rows such as "Ran npm test", "Read SKILL.md", or "Edited 2 files". Rows with useful inspectable material can expand again: read rows show light file previews, edit rows show per-file change panels, and shell rows show command/output without provider shell wrappers when possible. Prose-like read previews use the same markdown renderer as wiki pages; markdown links to `.almanac/pages/*.md` route back into viewer page routes through `viewer/app.js`. Edit details stay focused on the changed hunks first, with page links when the changed path is a wiki page so the full page remains reachable without dumping the whole file into the transcript. This keeps `/bin/zsh -lc` wrappers and raw tool payloads out of the default reading path. Helper and unknown-actor tool entries are not folded into root activity groups because subagent work needs visible attribution. Debug mode keeps each tool call as its own top-level timeline row with per-row offsets and full audit details.

Normal mode exposes only the transcript mode switch (`normal` / `debug`) above the readable transcript. The `all` / `main` / `tools` / `raw` event filters are Debug-only controls because they operate on the raw event stream rather than the Normal-mode narrative projection.

Polling behavior: while `displayStatus` is `queued` or `running`, the detail view schedules a re-fetch every ~1.5 seconds via `jobs-view.js`. On re-render, any existing poll timer is cancelled before scheduling a new one. Polling stops automatically when the route changes or the status reaches a terminal state.

The poll timer is private state inside `createJobsView()` in `viewer/jobs-view.js`. Route changes call `jobsView.clearPoll()` from `viewer/app.js`, keeping the global router aware of cleanup without storing jobs-specific state in the main viewer shell.

## UI direction

The frontend uses the `usealmanac.com` brand direction: warm paper surfaces, Palatino-style serif reading typography, supporting sans/mono stacks that match the landing page, and botanical green accents. Color tokens live in `viewer/app.css` under the `--ca-*` namespace:

```css
--ca-bg: #faf6ed;
--ca-surface: #f4efe4;
--ca-surface-deep: #ede5d2;
--ca-paper: #fffaf0;
--ca-border: #d8d0c0;
--ca-text: #342f25;
--ca-muted: #695f50;
--ca-accent: #166534;
--ca-accent-hover: #15803d;
--ca-accent-bright: #16a34a;
--ca-serif: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
--ca-sans: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--ca-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

The accent color was revised from OpenAlmanac navy (`#1a3a5c`) to the usealmanac green (`#166534`) on 2026-05-12 so the local viewer matches the public landing page. A 2026-05-15 attempt to switch the viewer to a brighter OpenAlmanac-inspired blue (`#255f8f`) was reverted at user request, so green remains the active viewer direction. The active token namespace is `--ca-*` in `viewer/app.css`.

The brand mark is the usealmanac open-book logo at `viewer/almanac-logo.png`. The left rail subtitle is `Agent-maintained knowledge`, matching the landing-page eyebrow.

Three-panel layout (desktop):

```text
Left rail        Main reader              Right rail
-----------      ------------------       ----------
Search           Rendered page            Backlinks
Topics list      (wikilinks clickable)    File refs
Recent pages
```

The left rail handles navigation and search. The main reader renders markdown (headings, paragraphs, lists, code blocks, inline code, wikilinks). The right rail shows backlinks and file references. Wikilinks in the reader navigate within the viewer via client-side routing.

## Relationship to filesystem layout

The viewer is the reason a full two-level docs tree is not needed. Because the viewer handles navigation, topic browsing, and backlinks, the `browse/` pages in [[wiki-organization-primitives]] can stay small and curated instead of becoming a complete parallel hierarchy.

The viewer still reads from `.almanac/pages/` — the migration to a visible `almanac/` directory discussed in [[wiki-organization-primitives]] has not been implemented as of 2026-05-10 and is a breaking spec change that would need a migration command.

## Testing

`test/serve-command.test.ts` starts the server at port 0 (OS-assigned), verifies the static HTML is served, confirms `/api/overview` returns correct page counts, and checks `/api/page/:slug` returns title and body.

`test/viewer-api.test.ts` tests `createViewerApi()` in isolation: seeds a repo with two linked pages, verifies `overview()`, `page()` (including backlinks and file refs), `topic()`, `search()`, `file()`, `jobs()`, and `job(runId)` (including JSONL parsing and invalid-line handling).

`test/viewer-ui-assets.test.ts` checks that the served static assets include expected strings: the jobs nav item, jobs-list CSS classes, and job-detail markup patterns. This guards the HTML/JS/CSS bundle against accidental deletion of feature-critical strings.

`test/viewer-jobs-transcript.test.ts` tests `buildTranscript()` and `getToolCardModel()` in isolation: verifies that streamed `text_delta` events are accumulated into a single assistant bubble, that `done` result text is appended to the bubble, that `tool_use` and `tool_result` entries are paired by ID, that unmatched `tool_result` entries produce standalone tool rows, that `tool_summary` and `context_usage` events stay out of the visible transcript, and that invalid JSONL lines surface as error rows rather than throwing.
