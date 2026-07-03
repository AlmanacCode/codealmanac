---
page_id: architecture-run-ledger-and-jobs
title: Run Ledger And Jobs
summary: The run ledger stores durable operation records, event logs, harness transcripts, specs, locks, and user-facing job control.
topics: [architecture, lifecycle, storage]
sources:
  - id: runs-service
    type: file
    path: src/codealmanac/services/runs/service.py
  - id: run-store
    type: file
    path: src/codealmanac/services/runs/store.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Run Ledger And Jobs

The run ledger is the durable record of lifecycle work. `RunsService` starts, queues, lists, shows, logs, attaches, streams, records events, marks running, stores harness transcripts, finishes, and cancels runs; the public `jobs` commands expose that ledger to users. [@runs-service] [@live-agreement]

## What state does it own?

Runs own lifecycle state transitions. They start as queued, workflows mark them running, and terminal finish calls move them to done, failed, or cancelled. Cancellation is durable run state rather than a CLI-side file edit. [@live-agreement]

## Why are store files split?

The live agreement splits run persistence into path validation, JSON IO, locks, transitions, factory construction, queries, and the service-facing store facade. [@live-agreement] [@run-store]

## Where is the exact shape listed?

See `[[reference-run-records]]` and `[[reference-run-events]]`.

