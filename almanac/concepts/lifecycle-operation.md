---
title: Lifecycle Operation
topics: [concepts, lifecycle]
sources:
  - id: build-workflow
    type: file
    path: src/codealmanac/workflows/build/service.py
    note: Build workflow implementation.
  - id: ingest-workflow
    type: file
    path: src/codealmanac/workflows/ingest/service.py
    note: Ingest workflow implementation.
  - id: garden-workflow
    type: file
    path: src/codealmanac/workflows/garden/service.py
    note: Garden workflow implementation.
  - id: operation-runner
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Shared execution path for page-writing operations.
  - id: run-queue-service
    type: file
    path: src/codealmanac/workflows/run_queue/service.py
    note: RunQueue.queue_build/queue_ingest/queue_garden queue the run record a worker later executes.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active decisions about runs, sync, and lifecycle semantics.
---

# Lifecycle Operation

A lifecycle operation is a page-writing workflow that asks a configured local agent harness to create or improve wiki Markdown. In this codebase, the lifecycle operation kinds are build, ingest, and garden: build creates the first useful wiki, ingest folds selected source material into an existing wiki, and garden improves the existing wiki graph [@build-workflow] [@ingest-workflow] [@garden-workflow]. These operations are the only normal paths that invoke AI to write page prose.

The concept matters because it keeps judgmentful wiki writing separate from read commands and deterministic organization commands. Search, show, health, and validate may read or refresh derived state, but they do not decide what prose belongs in a page. Lifecycle operations prepare context, call a harness, refresh the index after a successful harness run, validate the wiki, and finish the run [@operation-runner].

## The Three Operation Kinds

Build is the initialization path for a new repository wiki. Before a `BUILD` run is queued, build preparation rejects an existing `almanac/`, registers the repository, and initializes a minimal wiki [@build-workflow] [@run-queue-service]. When that queued run executes, build renders a build prompt with repository, wiki, manual, and source-control context [@build-workflow].

Ingest queues an `INGEST` run for an existing repository [@run-queue-service]. When that run executes, it resolves selected inputs into source briefs, loads bounded source runtime snapshots, and renders an ingest prompt with those sources and manual documents [@ingest-workflow]. Ingest is for concrete material such as files, directories, diffs, GitHub items, URLs, or transcripts.

Garden queues a `GARDEN` run for an existing wiki [@run-queue-service]. When that run executes, garden reads the current index summary and health report, then renders a prompt focused on graph quality, stale claims, links, topics, weak leads, and unsupported claims [@garden-workflow].

## Shared Execution

The individual workflows do not each own harness plumbing. They delegate the common page-run path to `OperationRunner`, which marks the run running, calls the harness, records transcript events, validates harness success, refreshes the index, validates wiki health, and marks the run done [@operation-runner].

That shared path makes lifecycle operations one product family. The operation-specific workflow decides what context and prompt to provide. The runner owns run-state mechanics, harness recording, index refresh, and final validation.

## Sync Is Not An Operation

Sync is related, but it is not a lifecycle operation. The live agreement defines sync as a scanner that reads local Claude and Codex transcript stores, groups active transcripts by registered repository, and queues ordinary ingest runs [@live-agreement]. In other words, sync can trigger ingest, but ingest is the page-writing operation.

This distinction keeps background discovery separate from wiki authorship. Sync is a producer of queued ingest run specs, not a fourth agent-writing operation; [Run queue and sync](../architecture/lifecycle/run-queue-and-sync) covers the worker and queue mechanics that turn a sync scan into queued runs.

## Related Pages

The architecture view is [Lifecycle workflows](../architecture/lifecycle/workflows). The shared runner is covered by [Operation runner](../architecture/lifecycle/operation-runner). Queueing and the sync scanner are covered by [Run queue and sync](../architecture/lifecycle/run-queue-and-sync). The persisted states and events are listed in [Run states and events](../reference/runs/run-states-and-events).
