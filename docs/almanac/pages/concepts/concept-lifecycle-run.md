---
page_id: concept-lifecycle-run
title: Lifecycle Run
summary: A lifecycle run is the durable record for a write-capable operation such as ingest, garden, or queued background work.
topics: [concepts, lifecycle]
sources:
  - id: runs-models
    type: file
    path: src/codealmanac/services/runs/models.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: runs-service
    type: file
    path: src/codealmanac/services/runs/service.py
---

# Lifecycle Run

A lifecycle run records a write-capable operation through states such as queued, running, done, failed, and cancelled. The run service owns creation, state transitions, log events, attach streaming, cancellation, queued specs, and worker locks under the selected Almanac root. [@runs-models] [@live-agreement] [@runs-service]

## Why are runs durable?

Lifecycle operations invoke an agent harness and may run in the background. Durable records let users inspect logs, attach to active work, cancel queued or running work, and debug failures later. [@runs-service]

## What is the difference between a run and a job?

The code models the durable object as a run. The public CLI uses `jobs` commands to list, show, stream, and cancel those runs. See `[[reference-run-records]]`.

## Where does the full flow live?

Read `[[architecture-run-ledger-and-jobs]]`, `[[architecture-page-run-workflow]]`, and `[[architecture-background-queue]]`.

