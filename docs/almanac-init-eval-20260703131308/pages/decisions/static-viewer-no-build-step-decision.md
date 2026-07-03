---
title: Static Viewer No Build Step Decision
topics: [decisions, viewer]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: package
    type: file
    path: pyproject.toml
  - id: assets
    type: file
    path: src/codealmanac/server/assets/
---

# Static Viewer No Build Step Decision

The local viewer uses static package-data HTML, CSS, and ES modules while it remains a small read-only wiki browser. It does not use React, Next.js, Vite, or another frontend build step yet [@agreement].

## Context

The live agreement treats Bulletproof React as a frontend architecture reference, not a mandate to add React or Next.js. Static ES modules are the current seam for API calls, routes, DOM components, and renderers [@agreement].

## Decision

Viewer assets are shipped as Python package data from `src/codealmanac/server/assets/` and `server/assets/viewer/` [@package].

## Consequences

Use [[viewer-server-and-static-ui]] when changing the viewer. Add a build tool only when real UI complexity makes static package data harder to maintain than a small built frontend.
