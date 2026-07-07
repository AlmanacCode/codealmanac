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
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active decisions about runs, sync, and lifecycle semantics.
---

# Lifecycle Operation

A lifecycle operation is a page-writing workflow that asks a configured local agent harness to create or improve wiki Markdown. In this codebase, the lifecycle operation kinds are build, ingest, and garden: build creates the first useful wiki, ingest folds selected source material into an existing wiki, and garden improves the existing wiki graph [@build-workflow] [@ingest-workflow] [@garden-workflow]. These operations are the only normal paths that invoke AI to write page prose.

The concept matters because it keeps judgmentful wiki writing separate from read commands and deterministic organization commands. Search, show, health, and validate may read or refresh derived state, but they do not decide what prose belongs in a page. Lifecycle operations prepare context, call a harness, validate the mutation, refresh the index, and finish the run [@operation-runner].

## The Three Operation Kinds

Build is the initialization path for a new repository wiki. It rejects an existing `almanac/`, registers the repository, initializes a minimal wiki, starts a `BUILD` run, and renders a build prompt with repository, wiki, manual, and source-control context [@build-workflow].

Ingest starts an `INGEST` run for an existing repository. It resolves selected inputs into source briefs, loads bounded source runtime snapshots, and renders an ingest prompt with those sources and manual documents [@ingest-workflow]. Ingest is for concrete material such as files, directories, diffs, GitHub items, URLs, or transcripts.

Garden starts a `GARDEN` run for an existing wiki. It reads the current index summary and health report, then renders a prompt focused on graph quality, stale claims, links, topics, weak leads, and unsupported claims [@garden-workflow].

## Shared Execution

The individual workflows do not each own harness plumbing. They delegate the common page-run path to `OperationRunner`, which marks the run running, captures mutation preflight, calls the harness, records transcript events, validates changed files, refreshes the index, validates wiki health, and marks the run done [@operation-runner].

That shared path makes lifecycle operations one product family. The operation-specific workflow decides what context and prompt to provide. The runner owns the safety and run-state mechanics.

## Sync Is Not An Operation

Sync is related, but it is not a lifecycle operation. The live agreement defines sync as a scanner that reads local Claude and Codex transcript stores, groups active transcripts by registered repository, and queues ordinary ingest runs [@live-agreement]. In other words, sync can trigger ingest, but ingest is the page-writing operation.

This distinction keeps background discovery separate from wiki authorship. If a future page explains queued runs and workers, it should treat sync as a producer of run specs, not as a fourth agent-writing operation.

## Related Pages

The architecture view is [Lifecycle workflows](../architecture/lifecycle/workflows). The shared runner is covered by [Operation runner](../architecture/lifecycle/operation-runner). The persisted states and events are listed in [Run states and events](../reference/runs/run-states-and-events).
