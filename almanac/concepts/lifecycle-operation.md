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

The concept matters because it keeps judgmentful wiki writing separate from read commands and deterministic organization commands. Search, show, health, and validate may read or refresh derived state, but they do not decide what prose belongs in a page. Lifecycle operations prepare context, call a harness, refresh the index after a successful harness run, validate the wiki, and finish the run [@operation-runner].

## What Makes It A Product Family

Build, ingest, and garden have different inputs, but each produces an agent-writing prompt for wiki source under `almanac/` [@build-workflow] [@ingest-workflow] [@garden-workflow]. That shared purpose is what makes them lifecycle operations instead of ordinary commands.

The operation-specific workflow decides what context the agent receives. Build prepares a new wiki, ingest prepares selected source material, and garden prepares the existing wiki graph and health summary [@build-workflow] [@ingest-workflow] [@garden-workflow]. The detailed control flow belongs in [Lifecycle workflows](../architecture/lifecycle/workflows).

## Shared Execution Boundary

Lifecycle operations meet the rest of the system at `OperationRunner`. The runner owns the common run state, harness recording, index refresh, validation, and completion path after a workflow has prepared its prompt [@operation-runner]. That boundary is why workflow pages can explain operation purpose without each re-describing harness plumbing.

## Sync Is Not An Operation

Sync is related, but it is not a lifecycle operation. The live agreement defines sync as a scanner that reads local Claude, Codex, and OpenCode transcript stores, groups active transcripts by registered repository, and queues ordinary ingest runs [@live-agreement]. In other words, sync can trigger ingest, but ingest is the page-writing operation.

This distinction keeps background discovery separate from wiki authorship. If a future page explains queued runs and workers, it should treat sync as a producer of run specs, not as a fourth agent-writing operation.

## Related Pages

The architecture view is [Lifecycle workflows](../architecture/lifecycle/workflows). The shared runner is covered by [Operation runner](../architecture/lifecycle/operation-runner). The persisted states and events are listed in [Run states and events](../reference/runs/run-states-and-events).
