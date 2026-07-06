---
title: Lifecycle Runs
summary: Build, ingest, and garden share one operation runner and one machine-level run queue.
topics: [architecture, operations, agents]
sources:
  - id: operations
    type: file
    path: src/codealmanac/workflows/operations/service.py
    note: Shared operation runner for lifecycle operations.
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
    path: src/codealmanac/workflows/lifecycle_mutation.py
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
    note: Queued lifecycle run persistence and rehydration.
  - id: commit-policy
    type: file
    path: src/codealmanac/workflows/lifecycle_commit.py
    note: Prompt-facing lifecycle commit policy.
  - id: local-state
    type: file
    path: src/codealmanac/settings.py
    note: LocalStatePaths defines machine-level DB and per-repository index paths.
  - id: validation
    type: file
    path: src/codealmanac/services/health/service.py
    note: Validation service used before lifecycle success.
---

# Lifecycle Runs

`BuildWorkflow`, `IngestWorkflow`, and `GardenWorkflow` each prepare operation-specific context and delegate harness execution, run events, mutation safety, index refresh, and validation to `OperationRunner` [@operations] [@ingest] [@garden].

Lifecycle prompts include a `source_control` context block that carries whether auto-commit is allowed, the wiki source files agents may commit, forbidden file categories, and the `almanac: <summary>` commit-message shape [@ingest] [@garden] [@commit-policy]. Queued runs store the target repository on the run record and persist the selected harness, inputs, guidance, and auto-commit flag in `RunSpec`; the worker restores that spec before running the operation [@queue] [@run-spec].

`OperationRunner` marks a run as running, records lifecycle events, executes the selected harness, records harness transcript and harness events, validates mutation safety, refreshes the index, runs wiki validation, and finishes the run [@operations] [@validation]. This keeps harness plumbing out of individual operation workflows.

Mutation policy snapshots Git status before the harness runs and validates that files changed during the run stay under the configured `almanac/` root after the harness finishes [@mutation]. A run may start with pre-existing user edits in `almanac/`; the before/after comparison is what decides what the agent changed [@mutation].

The run store writes queued records, spec-backed queued records, events, harness transcript references, running transitions, terminal transitions, cancellation, and worker lock state in `~/.codealmanac/codealmanac.db` [@runs] [@local-state]. Per-repository runtime directories hold derived indexes, not run records [@local-state].
