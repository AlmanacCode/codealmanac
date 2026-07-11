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
  - id: operation_harness
    type: file
    path: src/codealmanac/workflows/operations/harness.py
    note: Harness failure validation and run-event classification.
  - id: codex_result
    type: file
    path: src/codealmanac/integrations/harnesses/codex/run_result.py
    note: Codex app-server state to HarnessRunResult conversion.
  - id: codex_turn_events
    type: file
    path: src/codealmanac/integrations/harnesses/codex/result.py
    note: Codex turn completion, failure recording, and done-event rendering.
---

# Debug A Failed Lifecycle Run

Use this guide when `ingest` or `garden` leaves a run failed. The goal is to inspect the durable run record, read the event stream, identify whether the failure came from the harness, indexing, or validation, and then fix the wiki source or environment that caused it.

## Inspect The Run

Start with `codealmanac jobs`, then run `codealmanac jobs show <run-id>` and `codealmanac jobs logs <run-id>` for the failed run [@repo_readme]. The run store keeps the record and events in local state, so inspection does not depend on the original terminal session still being alive [@run_store].

If the run is still active, `codealmanac jobs attach <run-id>` reads the same record and events plus a terminal flag [@run_store]. Attach is useful for watching a long harness run, but a failed run is usually debugged from `jobs logs`.

## Interpret The Failure

Harness errors appear as run error or tool events because the operation runner records harness output before it validates success [@operation_runner]. Validation errors mean the Markdown tree could not pass the same checks described in [Health And Validation](../architecture/wiki/health-and-validation). Indexing errors usually point to page route collisions or malformed wiki source that prevented the derived index from refreshing.

When a Codex app-server run fails after it has already emitted assistant text, the run's visible `error` can quote the last assistant output instead of the provider failure. The Codex result builder sets `output_text` from `state.result or state.error`, and harness validation builds the failed-run message from that output text [@codex_result] [@operation_harness]. The structured failure is still recorded on the Codex error event when the root turn completion carries an error, so inspect the preceding `error` event and its `harness_event.failure` details before treating the run summary as the root cause [@codex_turn_events] [@operation_runner].

After fixing wiki source, run [Verify A Wiki Change](verify-a-wiki-change). If the failure was provider readiness or authentication, fix the local harness environment and queue a new lifecycle run.
