---
title: Viewer Server And Static UI
topics: [architecture, viewer, server]
sources:
  - id: server
    type: file
    path: src/codealmanac/server/app.py
  - id: api
    type: file
    path: src/codealmanac/server/api_routes.py
  - id: viewer
    type: file
    path: src/codealmanac/services/viewer/service.py
  - id: assets
    type: file
    path: src/codealmanac/server/assets/viewer/main.js
---

# Viewer Server And Static UI

`codealmanac serve` runs a local FastAPI app over repo-owned wiki pages. The server composition root registers API routes, error handlers, and static routes; it does not contain viewer business logic [@server].

API routes expose overview, page, search, file-reference, topic, jobs, and job-detail payloads by calling `ViewerService` [@api]. The viewer service builds DTOs from workspaces, index reads, runs, and markdown rendering [@viewer].

The browser UI is static package data: `index.html`, CSS, and ES modules for API calls, routes, components, renderers, and job polling [@assets]. The decision not to add a frontend build step yet is [[static-viewer-no-build-step-decision]].
