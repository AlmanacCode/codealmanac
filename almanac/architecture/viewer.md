---
title: Local Viewer
summary: codealmanac serve exposes a read-only browser surface over local wiki and run data.
topics: [architecture, cli, viewer]
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
  - id: server-app
    type: file
    path: src/codealmanac/server/app.py
    note: FastAPI viewer composition root.
  - id: server-api
    type: file
    path: src/codealmanac/server/api_routes.py
    note: HTTP API routes for viewer data.
  - id: service
    type: file
    path: src/codealmanac/services/viewer/service.py
    note: Viewer read service over index and run data.
  - id: scope
    type: file
    path: src/codealmanac/services/viewer/repository_scope.py
    note: Repository selection and available-wiki navigation.
  - id: requests
    type: file
    path: src/codealmanac/services/viewer/requests.py
    note: Viewer request validation.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Enforced viewer boundaries and read-only jobs surface.
  - id: viewer-tests
    type: file
    path: tests/test_viewer_service.py
    note: Viewer service behavior tests.
  - id: server-tests
    type: file
    path: tests/test_server.py
    note: Server API and static asset behavior tests.
---

# Local Viewer

`codealmanac serve` exposes the local browser viewer for repository wikis. The public README describes the viewer as read-only and says it renders pages, search, topics, backlinks, file-reference navigation, and registered-wiki switching from local wiki data [@readme]. The command accepts `--wiki`, `--host`, and `--port`; the parser defaults to `127.0.0.1:3927` when host and port are omitted [@parser].

## Entry Point

The serve dispatch imports `uvicorn` and the FastAPI server lazily, builds the server with the current working directory and optional wiki name, prints the viewer URL, and runs the server with warning-level logs [@dispatch]. `create_server_app` is the server composition root: it registers error handlers, API routes, and static routes without defining endpoint logic itself [@server-app].

The API layer maps HTTP routes to `ViewerService` request objects. `/api/overview`, `/api/page/{slug}`, `/api/search`, `/api/file`, `/api/topic/{slug}`, `/api/jobs`, and `/api/jobs/{run_id}` all call the viewer service through the application object [@server-api]. When `codealmanac serve --wiki <name>` scopes the server, the API uses that repository name instead of per-request `wiki` parameters [@server-api].

## Read Model

`ViewerService` is a read service over the index and run stores. Overview, page, search, file, and topic responses come from the index read model; jobs responses come from run listing and attach operations [@service]. The featured overview page is the wiki `README`, page responses include backlinks, outgoing links, file references, sources, rendered HTML, and related pages, and file-reference navigation delegates to the same mentions search used by the CLI [@service] [@viewer-tests].

Repository selection is isolated in `ViewerRepositoryScope`. The default selection uses normal repository read selection for the current working directory, then falls back to the first available registered repository if no cwd match exists [@scope]. Viewer navigation includes only repositories whose state is `AVAILABLE`; a scoped server returns only the selected repository in its navigation list [@scope] [@server-api].

## Boundaries

The viewer is intentionally read-only. The architecture tests forbid mutating run request types such as `StartRunRequest`, `FinishRunRequest`, `QueueRunRequest`, and `CancelRunRequest` from the viewer service, viewer jobs projection, server app, and server API modules [@architecture-tests]. The same tests keep repository selection and projection logic outside `ViewerService`, so service methods stay focused on assembling viewer responses from existing read models [@architecture-tests].

Request validation keeps browser inputs inside the local wiki reference space. File routes normalize repo-relative file and folder references and reject paths that leave that space [@requests]. Server tests cover page, search, file, topic, jobs, registered-wiki switching, 404 mapping for missing pages, 422 mapping for invalid requests, static asset path rejection, and rejection of path-shaped run ids [@server-tests].
