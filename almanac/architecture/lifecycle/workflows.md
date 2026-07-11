---
title: Lifecycle Workflows
topics: [architecture, lifecycle]
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
  - id: sync-workflow
    type: file
    path: src/codealmanac/workflows/sync/service.py
    note: Sync scanner and queue entrypoint.
  - id: operation-runner
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Shared execution path for page-writing operations.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active lifecycle and sync design decisions.
---

# Lifecycle Workflows

Lifecycle workflows are the high-level flows that create or improve a repo wiki. Build creates the first wiki, ingest folds selected source material into pages, and garden improves the existing wiki graph and content [@build-workflow] [@ingest-workflow] [@garden-workflow]. These three are the page-writing operation family described by [Lifecycle operation](../../concepts/lifecycle-operation).

The workflows prepare operation-specific context, but they do not each own harness execution, run completion, index refresh, or final validation. They delegate that common path to [Operation runner](operation-runner) [@operation-runner]. This keeps build, ingest, and garden different in purpose while sharing one run-execution path.

## Build

Build is the initialization workflow. At queue time, it prepares a repository target, rejects an existing `almanac/`, registers the repository, initializes a minimal wiki, and records a queued build run [@build-workflow]. Harness readiness is checked later by the worker through the shared operation path, not before the initial wiki scaffold is written.

When the worker executes the queued run, build calls the shared operation runner. Its task payload includes repository paths, the almanac root, `topics.yaml`, manual documents, optional guidance, and source-control policy [@build-workflow]. The stable instructions come from the packaged build agent described in [Agents and manuals](../runtime-resources/prompts-and-manuals). Build is therefore both setup and the first agent-authored wiki pass.

## Ingest

Ingest is the source-material workflow. It starts an `INGEST` run for a selected repository, resolves the requested inputs into source briefs, loads runtime snapshots for those sources, records those preparation steps, and renders the ingest prompt [@ingest-workflow].

The source runtime layer is important because ingest should give the agent concrete material, not just file names or user prose. The workflow also passes the almanac root as an ignored directory when inspecting source runtime, so the existing wiki is not accidentally treated as input material for the ingest source set [@ingest-workflow].

## Garden

Garden is the maintenance workflow for an existing wiki. Before calling the operation runner, it reads the current index summary and health report, records that it prepared garden context, and renders a prompt with the current wiki state [@garden-workflow].

Garden does not resolve external source material. Its job is to improve structure and quality from the wiki's own graph: weak pages, stale health findings, missing links, weak topics, and similar maintenance work.

## Sync Is Not An Operation

Sync is related to lifecycle work, but it is not a page-writing operation. `SyncWorkflow` evaluates local transcript candidates and uses `SyncIngestQueue` to queue ingest runs; it does not render a writing prompt or call the harness itself [@sync-workflow]. [Run queue and sync](run-queue-and-sync) covers that queue boundary and the worker that drains it.

The live agreement says the same thing as product design: sync is a scanner and trigger, not agent work and not a run [@live-agreement]. That distinction keeps discovery separate from authorship. Sync can decide that a transcript should become an ingest run, but ingest remains the lifecycle operation that writes wiki pages.

## Shared Contract

All page-writing workflows end at the operation runner. The runner marks the run running, invokes the harness, records transcript events, validates harness success, refreshes the index, validates the wiki, and only then marks the run done [@operation-runner].

When changing a workflow, preserve that division. Workflow services should decide what context and prompt the agent receives. Shared run state, harness recording, indexing, and final validation belong in the operation path.
