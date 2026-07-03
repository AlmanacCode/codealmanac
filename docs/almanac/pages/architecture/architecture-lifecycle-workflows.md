---
page_id: architecture-lifecycle-workflows
title: Lifecycle Workflows
summary: Lifecycle workflows are the write-capable operations that initialize, ingest, garden, queue, and sync wiki work.
topics: [architecture, lifecycle]
sources:
  - id: app
    type: file
    path: src/codealmanac/app.py
  - id: build
    type: file
    path: src/codealmanac/workflows/build/service.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
  - id: sync
    type: file
    path: src/codealmanac/workflows/sync/service.py
---

# Lifecycle Workflows

Lifecycle workflows are the operations that create or update wiki state. The composition root wires build, ingest, garden, run queue, and sync workflows; build initializes and refreshes a wiki, ingest writes from selected sources, garden improves the existing graph, sync turns eligible local transcripts into ingest work, and the queue drains background run specs. [@app] [@build] [@ingest] [@garden] [@sync]

## Which workflows write prose?

`ingest`, `garden`, and write-capable `sync` can invoke a harness that edits wiki pages. `build` initializes deterministic scaffold files and refreshes the index. [@build] [@ingest] [@garden] [@sync]

## What is shared between ingest and garden?

Both operation workflows delegate harness execution, mutation safety, run events, terminal state, and index refresh to `[[architecture-page-run-workflow]]`. [@ingest] [@garden]

## What should I read next?

Read `[[architecture-page-run-workflow]]`, `[[architecture-run-ledger-and-jobs]]`, and `[[architecture-sync-workflow]]`.

