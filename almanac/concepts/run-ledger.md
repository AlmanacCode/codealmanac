---
title: Run Ledger
topics: [concepts, runs]
sources:
  - id: run_service
    type: file
    path: src/codealmanac/services/runs/service.py
    note: Service API for creating, queueing, inspecting, attaching to, and cancelling runs.
  - id: run_store
    type: file
    path: src/codealmanac/services/runs/store.py
    note: Local SQLite persistence facade for run records, queued specs, events, and worker locks.
  - id: run_models
    type: file
    path: src/codealmanac/services/runs/models.py
    note: Typed run kinds, statuses, event kinds, queued specs, and attach snapshots.
  - id: jobs_parser
    type: file
    path: src/codealmanac/cli/parser/jobs.py
    note: Public jobs command surface for reading and controlling runs.
---

# Run Ledger

The run ledger is CodeAlmanac's local record of lifecycle work. It joins run records, queued run specs, run events, worker locks, transcript references, and job inspection into one durable model. The user sees it through `codealmanac jobs`, while internal services call it `runs` because it records the lifecycle state of build, ingest, and garden operations [@jobs_parser][@run_models].

A run is not just a log. It is the state object that says which repository the work belongs to, what kind of lifecycle operation it is, whether it is queued, running, done, failed, or cancelled, and what events have happened so far [@run_models]. The ledger lets agents and humans inspect background work without relying on hidden process state.

## What It Records

The core record is `RunRecord`. It stores a run id, repository id, run kind, status, title, timestamps, optional summary, optional error, page changes, and an optional harness transcript reference [@run_models]. Run kinds are limited to `build`, `ingest`, and `garden`; statuses move through `queued`, `running`, and terminal states such as `done`, `failed`, or `cancelled` [@run_models].

Queued work has an optional `RunSpec`. The spec stores the operation kind, harness, model, inputs, guidance, title, and auto-commit policy for work that a local worker can later pick up [@run_models]. That makes queue membership explicit: a queued run with a stored spec is work the worker can drain.

Events are stored separately from the run record. Each `RunLogEvent` has a sequence number, timestamp, kind, message, and optional normalized harness event [@run_models]. This is why `jobs logs` can show source-resolution facts, tool events, output, errors, and status changes as one ordered stream.

## How It Works

`RunsService` is the service boundary around the ledger. It starts runs, queues specs, lists runs, reads specs, finds the next queued run, records events, marks runs running, attaches harness transcripts, finishes runs, and cancels active work [@run_service]. It also filters reads by repository name so a job id from another registered repository is not exposed through the wrong wiki selection [@run_service].

`RunStore` owns persistence. It writes run records to the local database, stores the serialized spec beside the run record, appends status events, and delegates event sequencing to the event store [@run_store]. The same store exposes `attach`, which returns the current run record, all events, and a `terminal` flag for attach-style streaming [@run_store].

The public command name is `jobs`, not `runs`. The parser exposes `jobs`, `jobs show`, `jobs logs`, `jobs attach`, and `jobs cancel`, with JSON output available on the read/control commands [@jobs_parser]. That naming keeps the user surface practical while leaving the internal model precise.

## Why It Matters

Lifecycle commands can run through a local worker instead of blocking the terminal. The ledger is the common place where the request, current state, event stream, and cancellation decision meet. Pages such as [Run queue and sync](../architecture/lifecycle/run-queue-and-sync), [Run states and events](../reference/runs/run-states-and-events), and [Debug a failed lifecycle run](../guides/debug-a-failed-lifecycle-run) depend on this concept.

The ledger also keeps cancellation durable. Cancelling a queued or running run changes the stored record and appends a cancelled status event; attaching or listing later reads that state from the database rather than inferring it from a process [@run_store]. This makes background lifecycle work inspectable after the original command has exited.
