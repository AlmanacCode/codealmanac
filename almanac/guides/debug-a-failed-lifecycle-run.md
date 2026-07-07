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

Use this guide when `ingest` or `garden` leaves a run failed. The goal is to inspect the durable run record, read the event stream, identify whether the failure came from the harness, mutation safety, indexing, or validation, and then fix the wiki source or environment that caused it.

## Inspect The Run

Start with `codealmanac jobs`, then run `codealmanac jobs show <run-id>` and `codealmanac jobs logs <run-id>` for the failed run [@repo_readme]. The run store keeps the record and events in local state, so inspection does not depend on the original terminal session still being alive [@run_store].

If the run is still active, `codealmanac jobs attach <run-id>` reads the same record and events plus a terminal flag [@run_store]. Attach is useful for watching a long harness run, but a failed run is usually debugged from `jobs logs`.

## Interpret The Failure

Harness errors appear as run error or tool events because the operation runner records harness output before it validates success [@operation_runner]. Mutation safety errors mean the agent changed files outside the allowed wiki source area. Validation errors mean the Markdown tree could not pass the same checks described in [Health And Validation](../architecture/wiki/health-and-validation).

After fixing wiki source, run [Verify A Wiki Change](verify-a-wiki-change). If the failure was provider readiness or authentication, fix the local harness environment and queue a new lifecycle run.
