---
title: Local Viewer
topics: [architecture, viewer]
sources:
  - id: readme
    type: file
    path: README.md
    note: Public local viewer command and product contract.
  - id: parser
    type: file
    path: src/codealmanac/cli/parser/wiki.py
    note: Serve command flags and defaults.
  - id: dispatch
    type: file
    path: src/codealmanac/cli/dispatch/serve.py
    note: Serve command dispatch.
  - id: server_app
    type: file
    path: src/codealmanac/server/app.py
    note: FastAPI viewer composition root.
  - id: server_api
    type: file
    path: src/codealmanac/server/api_routes.py
    note: HTTP API routes for viewer data.
  - id: viewer_service
    type: file
    path: src/codealmanac/services/viewer/service.py
    note: Viewer service entrypoints and projection flow.
  - id: renderer
    type: file
    path: src/codealmanac/services/viewer/renderer.py
    note: Markdown rendering and leading-title-heading removal.
  - id: scope
    type: file
    path: src/codealmanac/services/viewer/repository_scope.py
    note: Repository selection and available-wiki navigation.
  - id: projections
    type: file
    path: src/codealmanac/services/viewer/projections.py
    note: Conversion from service read models to viewer models.
  - id: requests
    type: file
    path: src/codealmanac/services/viewer/requests.py
    note: Viewer request validation.
  - id: viewer_js
    type: file
    path: src/codealmanac/server/assets/viewer/main.js
    note: Browser-side routing, repository selection, navigation, and page tree rendering.
  - id: architecture_tests
    type: file
    path: tests/test_architecture.py
    note: Enforced viewer boundaries and read-only jobs surface.
  - id: viewer_tests
    type: file
    path: tests/test_viewer_service.py
    note: Tests for overview, search, pages, file refs, topics, jobs, and request validation.
  - id: server_tests
    type: file
    path: tests/test_server.py
    note: Server API and static asset behavior tests.
---

# Local Viewer

The local viewer is the read-only browser surface exposed by `codealmanac serve`. It projects repo wiki pages, topics, file evidence, registered wiki navigation, and lifecycle jobs from local state; it does not own a separate store or write path [@readme] [@viewer_service].

The command accepts `--wiki`, `--host`, `--port`, and `--no-open`, with parser defaults of `127.0.0.1:3927` when host and port are omitted [@parser]. It opens the viewer in the default browser unless `--no-open` is set. Pages, links, topics, source references, and file references come from the index read model. Job lists and job detail come from the [run ledger](../../concepts/run-ledger). The browser routes between those projections with hash routes and renders the current repository's wiki graph [@viewer_service] [@viewer_js].

For the public command contract, see [Public command surface](../../reference/cli/public-command-surface). For the run data shown in the jobs view, see [Run states and events](../../reference/runs/run-states-and-events).

## Entry Point

The serve dispatch imports `uvicorn` and the FastAPI server lazily, builds the server with the current working directory and optional wiki name, and prints the viewer URL [@dispatch]. Unless `--no-open` is set, a daemon thread waits for Uvicorn to bind successfully before opening that URL through Python's default-browser integration. The dispatch then runs the server with warning-level logs [@dispatch]. `create_server_app` is the server composition root: it registers error handlers, API routes, and static routes without defining endpoint logic itself [@server_app].

The API layer maps HTTP routes to `ViewerService` request objects. `/api/overview`, `/api/page/{slug}`, `/api/search`, `/api/file`, `/api/topic/{slug}`, `/api/jobs`, and `/api/jobs/{run_id}` all call the viewer service through the application object [@server_api]. When `codealmanac serve --wiki <name>` scopes the server, the API uses that repository name instead of per-request `wiki` parameters [@server_api].

## Service Shape

`ViewerService` is constructed with `RepositoriesService`, `IndexService`, `RunsService`, and `MarkdownRenderer` [@viewer_service]. Repository selection is handled through `ViewerRepositoryScope`, so every viewer request resolves the active repository before reading pages, topics, files, or jobs [@viewer_service] [@scope].

The default selection uses normal repository read selection for the current working directory, then falls back to the first available registered repository if no cwd match exists [@scope]. Viewer navigation includes only repositories whose state is `AVAILABLE`; a scoped server returns only the selected repository in its navigation list [@scope] [@server_api].

The main entrypoints are `overview`, `page`, `search`, `file`, `topic`, `jobs`, and `job` [@viewer_service]. `overview` returns repository navigation, page and topic counts, a limited page list, a full navigation page list, topics, and a featured README page when present [@viewer_service]. `search` delegates to index search. `topic` normalizes the topic slug, reads the topic with optional descendants, and raises `NotFoundError` if the topic does not exist [@viewer_service].

## Page Projection

Page detail combines index data with rendered Markdown. `page` loads the `PageView`, renders the body, and returns title, summary, topics, raw body, HTML, backlinks, outgoing links, file references, sources, and related pages [@viewer_service]. Related pages are derived from incoming and outgoing page links, with duplicates and self-links removed [@viewer_service].

`MarkdownRenderer.render` also drops a leading `# <title>` heading from the rendered body when it matches the page's title, through `drop_leading_title_heading` [@renderer]. This is the body-side half of the single-heading-per-view shape; the breadcrumb change described below is the header-side half.

The projection module keeps conversion rules small and explicit. It maps repositories, topics, sources, and page summaries into viewer models [@projections]. Source display order follows citation order when the renderer reports citations; uncited sources sort after cited sources by source id [@projections]. File paths are shown relative to the repository's `almanac/` path when possible, with the old `pages/` prefix stripped if it appears in indexed data [@projections].

Tests make the reader contract concrete. The viewer renders Markdown links as viewer routes, escapes script tags, exposes code-formatted file references, reports backlinks, lists pages that mention file and folder references, and rejects file requests outside repo-relative reference space [@viewer_tests].

## Jobs And Runs

The viewer exposes lifecycle jobs through run service reads. `jobs` lists recent runs for the selected repository, and `job` attaches to a run snapshot to return the run plus normalized events [@viewer_service]. Tests verify that job detail includes run kind, status, summary, harness transcript metadata, status events, output events, and normalized harness event payloads [@viewer_tests].

This keeps the viewer aligned with the public `jobs` control surface without giving it its own job state. The viewer can show what happened, but the run ledger remains the owner of lifecycle state.

## Browser Routing

The static viewer script keeps local UI state for the overview and selected repository [@viewer_js]. On startup it wires the search form, repository selector, and `hashchange` listener, then loads the overview and routes the current hash [@viewer_js].

Routes cover home, page, topic, search, file, jobs, and job detail [@viewer_js]. Repository changes clear job polling, reload the overview for the selected wiki, refresh navigation, and reroute the current hash [@viewer_js]. Navigation is built from topics and a folder-style page tree, so nested wiki paths appear as browseable folders rather than a flat page list [@viewer_js].

Each route reports its own breadcrumb trail instead of a single page-level title. The header renders that trail as `CodeAlmanac > ... > <current>`, with a page route contributing its folder path plus title and other routes (jobs, search, topics, files) contributing their own trail [@viewer_js]. This replaced an earlier header that repeated the page title as a second top-level heading; the current shape keeps exactly one page-title heading per view.

## Boundaries

The viewer is intentionally read-only. The architecture tests forbid mutating run request types such as `StartRunRequest`, `FinishRunRequest`, `QueueRunRequest`, and `CancelRunRequest` from the viewer service, viewer jobs projection, server app, and server API modules [@architecture_tests]. The same tests keep repository selection and projection logic outside `ViewerService`, so service methods stay focused on assembling viewer responses from existing read models [@architecture_tests].

Request validation keeps browser inputs inside the local wiki reference space. File routes normalize repo-relative file and folder references and reject paths that leave that space [@requests]. Server tests cover page, search, file, topic, jobs, registered-wiki switching, 404 mapping for missing pages, 422 mapping for invalid requests, static asset path rejection, and rejection of path-shaped run ids [@server_tests].

The result is a thin local viewer. It improves navigation and inspection, while the durable contracts remain in the index, run ledger, repository registry, and Markdown page format.

For the local files and databases behind those contracts, see [Local state layout](../../reference/local-state-layout).
