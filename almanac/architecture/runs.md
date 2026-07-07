---
title: Runs
summary: Build, ingest, and garden share one operation runner and one machine-level run queue.
topics: [architecture, operations, agents]
sources:
  - id: operations
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Shared operation runner for page-writing operations.
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
    note: Ingest operation workflow.
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
    note: Garden operation workflow.
  - id: mutation
    type: file
    path: src/codealmanac/workflows/operations/mutation.py
    note: Git snapshot and Almanac-root mutation policy.
  - id: runs
    type: file
    path: src/codealmanac/services/runs/store.py
    note: Run record, queue, event, and worker-lock persistence.
  - id: run-spec
    type: file
    path: src/codealmanac/services/runs/models.py
    note: Durable queued run spec shape.
  - id: queue
    type: file
    path: src/codealmanac/workflows/run_queue/service.py
    note: Queued run persistence and rehydration.
  - id: commit-policy
    type: file
    path: src/codealmanac/workflows/operations/commit.py
    note: Prompt-facing operation commit policy.
  - id: local-state
    type: file
    path: src/codealmanac/settings.py
    note: LocalStatePaths defines machine-level DB and per-repository index paths.
  - id: validation
    type: file
    path: src/codealmanac/services/health/service.py
    note: Validation service used before operation success.
  - id: readme
    type: file
    path: README.md
    note: Public jobs command surface.
  - id: jobs-parser
    type: file
    path: src/codealmanac/cli/parser/jobs.py
    note: Jobs command flags and subcommands.
  - id: jobs-dispatch
    type: file
    path: src/codealmanac/cli/dispatch/jobs.py
    note: Jobs CLI dispatch to the run service.
  - id: run-streaming
    type: file
    path: src/codealmanac/services/runs/streaming.py
    note: Attach streaming behavior.
  - id: run-transitions
    type: file
    path: src/codealmanac/services/runs/transitions.py
    note: Run status transitions and cancellation behavior.
---

# Runs

`BuildWorkflow`, `IngestWorkflow`, and `GardenWorkflow` each prepare operation-specific context and delegate harness execution, run events, mutation safety, index refresh, and validation to `OperationRunner` [@operations] [@ingest] [@garden].

Operation prompts include a `source_control` context block that carries whether auto-commit is allowed, the wiki source files agents may commit, forbidden file categories, and the `almanac: <summary>` commit-message shape [@ingest] [@garden] [@commit-policy]. Queued runs store the target repository on the run record and persist the selected harness, inputs, guidance, and auto-commit flag in `RunSpec`; the worker restores that spec before running the operation [@queue] [@run-spec].

`OperationRunner` marks a run as running, records operation events, executes the selected harness, records harness transcript and harness events, validates mutation safety, refreshes the index, runs wiki validation, and finishes the run [@operations] [@validation]. This keeps harness plumbing out of individual operation workflows.

## Job Inspection

The public job surface is `codealmanac jobs`: the base command lists local runs, and `show`, `logs`, `attach`, and `cancel` inspect or control one run id [@readme] [@jobs-parser]. `--wiki` scopes listing and lookup to a registered repository, `--limit` caps the list view, and every jobs command supports `--json` for scripted inspection [@jobs-parser].

Jobs dispatch is only a CLI adapter. It maps list, show, log, attach, and cancel requests to `RunsService` methods, so the terminal surface uses the same run records and events that operation workflows write [@jobs-dispatch].

`codealmanac jobs attach <run-id>` streams log events until the run reaches a terminal status; the streamer waits one poll for a terminal status event when the record is terminal but the final status event has not appeared yet [@run-streaming]. `codealmanac jobs cancel <run-id>` cancels queued or running records and reports no change when the run is already terminal [@run-transitions].

Mutation policy snapshots Git status before the harness runs and validates that files changed during the run stay under the configured `almanac/` root after the harness finishes [@mutation]. A run may start with pre-existing user edits in `almanac/`; the before/after comparison is what decides what the agent changed [@mutation].

The run store writes queued records, spec-backed queued records, events, harness transcript references, running transitions, terminal transitions, cancellation, and worker lock state in `~/.codealmanac/codealmanac.db` [@runs] [@local-state]. Per-repository runtime directories hold derived indexes, not run records [@local-state].
