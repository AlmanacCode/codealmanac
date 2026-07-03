---
page_id: reference-run-records
title: Run Records
summary: This page describes the durable records used for lifecycle jobs and background queue entries.
topics: [reference, lifecycle, storage]
sources:
  - id: runs-models
    type: file
    path: src/codealmanac/services/runs/models.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Run Records

Run records are durable lifecycle records stored under the Almanac root. They represent foreground runs, queued background runs, terminal results, cancellation, and attachable job history. [@runs-models] [@live-agreement]

## States

| State | Meaning |
|---|---|
| `queued` | Created and not yet running. |
| `running` | Workflow execution has started. |
| `done` | Workflow finished successfully. |
| `failed` | Workflow finished with an error. |
| `cancelled` | Queued or running work was cancelled. |

The live agreement says only workflows should mark running and only terminal finish calls should move to done, failed, or cancelled. [@live-agreement]

## Related pages

Read `[[architecture-run-ledger-and-jobs]]`, `[[architecture-background-queue]]`, and `[[reference-run-events]]`.

