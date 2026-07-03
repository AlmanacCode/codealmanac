---
page_id: architecture-local-viewer
title: Local Viewer
summary: The local viewer serves indexed wiki data and rendered markdown through a FastAPI app and static browser assets.
topics: [architecture]
sources:
  - id: server-app
    type: file
    path: src/codealmanac/server/app.py
  - id: api-routes
    type: file
    path: src/codealmanac/server/api_routes.py
  - id: viewer-service
    type: file
    path: src/codealmanac/services/viewer/service.py
  - id: viewer-renderer
    type: file
    path: src/codealmanac/services/viewer/renderer.py
---

# Local Viewer

The local viewer is a read-only browser surface over the indexed wiki. The server app mounts API routes and static assets, while `ViewerService` projects workspaces, pages, topics, file references, jobs, search results, and rendered markdown for the browser. [@server-app] [@api-routes] [@viewer-service] [@viewer-renderer]

## What does the viewer read?

The viewer reads through services and the index. It does not become the source of truth; markdown files under the Almanac root remain the editable source. [@viewer-service]

## What pages can it show?

The service exposes overview, page, search, file reference, topic, jobs, and job detail views. [@viewer-service]

## What should I read next?

Use `[[guide-verify-viewer]]` for a maintenance task and `[[reference-cli-commands]]` for the `serve` command.

