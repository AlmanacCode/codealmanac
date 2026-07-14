---
title: Run States And Events
topics: [reference, runs, lifecycle]
sources:
  - id: run-models
    type: file
    path: src/codealmanac/services/runs/models.py
    note: Run kinds, statuses, events, records, specs, and attach models.
  - id: run-transitions
    type: file
    path: src/codealmanac/services/runs/transitions.py
    note: Start, finish, transcript, cancel, and queued-message transitions.
  - id: run-events
    type: file
    path: src/codealmanac/services/runs/events.py
    note: Run event sequencing and storage.
  - id: run-streaming
    type: file
    path: src/codealmanac/services/runs/streaming.py
    note: Attach-stream polling and terminal behavior.
  - id: run-store
    type: file
    path: src/codealmanac/services/runs/store.py
    note: Run persistence, status events, queue specs, and cancellation writes.
  - id: run-tests
    type: file
    path: tests/test_runs_service.py
    note: Tests for transitions, queue specs, attach, cancellation, and run-id validation.
  - id: run-process-tests
    type: file
    path: tests/test_run_process.py
    note: Real subprocess tests for descendant termination and PID-reuse refusal.
  - id: run-worker-spawner
    type: file
    path: src/codealmanac/integrations/runs/process.py
    note: Detached process spawning, identity verification, and tree termination.
  - id: jobs-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/jobs.py
    note: Jobs command dispatch and attach interruption behavior.
  - id: jobs-cli-tests
    type: file
    path: tests/test_cli.py
    note: Human, piped, and JSON CLI behavior for jobs commands.
---

# Run States And Events

Run states and events are the exact ledger contract for lifecycle work. A run records one build, ingest, or garden operation, while ordered events record status changes, messages, tool activity, output, and errors [@run-models]. The user-facing `jobs` commands read this same model through the [run ledger](../../concepts/run-ledger).

The queue and worker path depends on this contract. Queued specs describe work to drain, status transitions mark progress, cancellation is durable state, and attach streams the ordered event log until the run reaches a terminal status [@run-store] [@run-streaming]. The queue behavior is covered in [Run queue and sync](../../architecture/lifecycle/run-queue-and-sync).

## Run Kinds

| Kind | Meaning |
| --- | --- |
| `build` | Initial wiki-building lifecycle work. |
| `ingest` | Source-material ingestion into the wiki. |
| `garden` | Maintenance and improvement work over the existing wiki. |

`RunKind` is limited to `build`, `ingest`, and `garden` [@run-models]. Queued `RunSpec` validation allows those same kinds: ingest requires at least one input, while build and garden reject inputs [@run-models].

## Statuses

| Status | Terminal | Notes |
| --- | --- | --- |
| `queued` | No | Initial status for newly created or queued runs. |
| `running` | No | Set when a workflow or worker starts executing the run. |
| `done` | Yes | Successful terminal status. |
| `failed` | Yes | Failed terminal status, usually with `error`. |
| `cancelled` | Yes | Durable cancellation status. |

New records start as `queued` and immediately receive a status event such as `queued ingest` or `queued garden` [@run-store] [@run-transitions]. `mark_running` can move a queued run to `running`; attempting to start from another non-running status raises a conflict [@run-transitions]. Terminal statuses are `done`, `failed`, and `cancelled` [@run-models].

`finish` writes a terminal status, summary, error, timestamps, and a matching status event. If the run is already `cancelled`, finish returns the cancelled record unchanged, so a late success or failure cannot overwrite cancellation [@run-transitions] [@run-store].

## Event Kinds

| Event kind | Use |
| --- | --- |
| `status` | Queue, running, terminal, and cancellation status messages. |
| `message` | Product-level progress messages. |
| `tool` | Harness tool activity or normalized tool events. |
| `output` | Harness or operation output. |
| `error` | Error information. |

Each `RunLogEvent` has a run id, positive sequence number, timestamp, event kind, message, and optional normalized harness event payload [@run-models]. `RunEventStore` assigns the next sequence as `MAX(sequence) + 1` for the run and lists events in ascending sequence order [@run-events].

## Queued Specs

`RunSpec` stores the durable work request for queued runs. Its fields are `version`, `kind`, `harness`, `model`, `inputs`, `title`, `guidance`, and `auto_commit` [@run-models]. Version must be `1`. Ingest specs require at least one input; build and garden specs must not contain inputs [@run-models].

A queued run with no stored spec is not valid worker work. The run queue treats queue membership as a queued run with durable spec JSON, and the worker marks malformed queued work failed instead of guessing how to run it [@run-store].

## Cancellation

Queued cancellation atomically changes the record to `cancelled` and appends the terminal status event, which prevents executor claim [@run-transitions] [@run-store]. Cancelling an already terminal run is a no-op result with `changed: false` [@run-transitions].

A running record carries `RunExecutionRef`: an execution id, PID, and process birth time [@run-models]. Running cancellation first stores `cancellation_requested_at` and appends a non-terminal `cancellation requested` message. The process controller verifies the PID still has the recorded birth time, freezes and terminates the executor tree, waits, force-kills survivors, and confirms exit. Only then does `finish_cancellation` write the terminal `cancelled` status event [@run-worker-spawner] [@run-store]. If termination cannot be confirmed, the run stays non-terminal and the command fails rather than claiming cancellation.

Tests cover queued and running cancellation, executor-tree termination, PID-reuse refusal, queue continuation, terminal preservation, and unsafe run-id rejection [@run-tests] [@run-process-tests]. Run ids must match the `^[A-Za-z0-9_-]+$` pattern [@run-models].

## Attach And Logs

`log` is a snapshot read of all events for one run. `attach` returns the current record, all events, and whether the status is terminal [@run-store]. `RunAttachStreamer` polls `RunStore.attach(...)`, yields only events after the last seen sequence, and stops after a terminal snapshot [@run-streaming].

Attach has one settle rule: if the record is terminal but the matching terminal `status` event has not appeared yet, the streamer waits one extra poll before yielding the terminal update [@run-streaming]. This keeps `jobs attach` from ending before the final status event is visible.

Pressing `Ctrl-C` while following a run detaches only the foreground
`jobs attach` command. The run is not cancelled or otherwise mutated, and the
CLI prints the explicit `codealmanac jobs cancel <run-id>` command before
exiting with status `130`. JSON attach streams receive no human detachment
text, so their NDJSON event stream remains valid [@jobs-dispatch]
[@jobs-cli-tests].

For operator-facing recovery steps, see [Debug a failed lifecycle run](../../guides/debug-a-failed-lifecycle-run).
