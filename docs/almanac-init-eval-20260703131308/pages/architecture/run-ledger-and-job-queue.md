---
title: Run Ledger And Job Queue
topics: [architecture, runs]
sources:
  - id: models
    type: file
    path: src/codealmanac/services/runs/models.py
  - id: service
    type: file
    path: src/codealmanac/services/runs/service.py
  - id: queue
    type: file
    path: src/codealmanac/workflows/run_queue/service.py
  - id: io
    type: file
    path: src/codealmanac/services/runs/io.py
---

# Run Ledger And Job Queue

The run ledger records lifecycle jobs as JSON records, optional durable specs, JSONL logs, and worker locks. Runs move through `queued`, `running`, `done`, `failed`, or `cancelled`; queued background work is a run with a matching `.spec.json` file [@models].

`RunsService` resolves the workspace, reads and writes run state through `RunStore`, supports listing/show/log/attach/cancel, and reads both user-level and legacy per-root run directories when needed [@service]. `RunLedgerIO` owns atomic JSON writes and append-only JSONL log writes [@io].

`RunQueueWorkflow` queues init/ingest/garden specs, spawns a worker, acquires a worker lock when draining, and dispatches each spec back to the corresponding workflow [@queue]. Exact files are in [[run-ledger-files-reference]].
