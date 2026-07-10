---
title: Debug A Failed Lifecycle Run
topics: [guides, lifecycle, runs]
sources:
  - id: repo_readme
    type: file
    path: README.md
    note: User-facing jobs and lifecycle command examples.
  - id: run_store
    type: file
    path: src/codealmanac/services/runs/store.py
    note: Run attach, log, finish, and cancel persistence behavior.
  - id: operation_runner
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Operation failure recording and validation path.
---

# Debug A Failed Lifecycle Run

Use this guide when `ingest` or `garden` leaves a run failed. The goal is to inspect the durable run record, read the event stream, identify whether the failure came from the harness, indexing, or validation, and then fix the wiki source or environment that caused it.

## Inspect The Run

Start with `codealmanac jobs`, then run `codealmanac jobs show <run-id>` and `codealmanac jobs logs <run-id>` for the failed run [@repo_readme]. The run store keeps the record and events in local state, so inspection does not depend on the original terminal session still being alive [@run_store].

If the run is still active, `codealmanac jobs attach <run-id>` reads the same record and events plus a terminal flag [@run_store]. Attach is useful for watching a long harness run, but a failed run is usually debugged from `jobs logs`.

If a run is stuck rather than failed, `codealmanac jobs cancel <run-id>` only marks the record `cancelled`; it does not stop the harness process actually doing the work [@run_store]. See [Run States And Events](../reference/runs/run-states-and-events) for the exact cancellation contract. To stop the work itself, kill the `child_pid` reported when the run was queued.

## Interpret The Failure

Harness errors appear as run error or tool events because the operation runner records harness output before it validates success [@operation_runner]. Validation errors mean the Markdown tree could not pass the same checks described in [Health And Validation](../architecture/wiki/health-and-validation). Indexing errors usually point to page route collisions or malformed wiki source that prevented the derived index from refreshing.

After fixing wiki source, run [Verify A Wiki Change](verify-a-wiki-change). If the failure was provider readiness or authentication, run `codealmanac doctor` to see which harness is unavailable and why, repair the reported issue (missing binary, expired login, missing API key), then queue a new lifecycle run with `codealmanac ingest` or `codealmanac garden`.
