---
page_id: architecture-composition-root
title: Composition Root
summary: create_app is the place where CodeAlmanac wires services, workflows, stores, and integration adapters.
topics: [architecture]
sources:
  - id: app
    type: file
    path: src/codealmanac/app.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Composition Root

`create_app()` is the Python composition root. It creates service instances, injects stores and adapters, builds lifecycle workflows, and returns the `CodeAlmanac` object that CLI dispatchers and tests call. [@app]

## What gets wired here?

The root wires workspace, config, automation, manual, wiki, index, search, pages, topics, health, diagnostics, tagging, updates, setup, runs, viewer, sources, prompts, and harness services. It also wires build, ingest, garden, queue, and sync workflows. [@app]

## Why does this matter?

The live agreement says services own product verbs, stores own persistence, integrations implement ports, and the application root owns dependency wiring. `create_app()` is where that rule becomes executable. [@live-agreement] [@app]

## What depends on it?

`[[architecture-lifecycle-workflows]]`, `[[architecture-harness-system]]`, and `[[architecture-source-system]]` all depend on the adapters and workflows assembled here.

The system overview is the entry point for this page. Read `[[architecture-system-overview]]` before using this page as a wiring reference. [@app] [@live-agreement]
