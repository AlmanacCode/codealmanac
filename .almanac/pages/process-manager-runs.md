---
title: Lifecycle Run Ledger
summary: Repo-local lifecycle work is recorded as runs under `codealmanac.runs`, while cloud and local trigger executions keep the run noun.
topics:
  - systems
  - storage
  - cli
  - agents
sources:
  - id: slice-85-plan
    type: file
    path: docs/plans/2026-07-03-slice-85-run-ledger-naming.md
    note: "Records the accepted Slice 85 boundary: lifecycle records are runs, cloud/local trigger executions remain runs."
  - id: slice-86-plan
    type: file
    path: docs/plans/2026-07-03-slice-86-engine-runs-and-workspaces.md
    note: "Records the accepted Slice 86 boundary: engine request/result artifacts and detached workspaces are engine-owned runtime infrastructure."
  - id: app-composition
    type: file
    path: src/codealmanac/app.py
    note: Wires `RunLedgerService`, `RunQueueWorkflow`, and the `CodeAlmanacEngine` facade through the composition root.
  - id: run-models
    type: file
    path: src/codealmanac/runs/ledger/models.py
    note: Defines `RunRecord`, `RunLogEvent`, `RunSpec`, `RunKind`, `RunStatus`, and `run_id` validation.
  - id: run-service
    type: file
    path: src/codealmanac/runs/ledger/service.py
    note: Resolves workspaces and owns lifecycle run listing, showing, logging, attaching, queueing, locking, and cancellation.
  - id: run-store
    type: file
    path: src/codealmanac/runs/ledger/store.py
    note: Owns run record/spec/log persistence and status transitions over file-backed run directories.
  - id: run-paths
    type: file
    path: src/codealmanac/runs/ledger/paths.py
    note: Defines current run artifact names and centralizes `RunId` path validation.
  - id: run-queue
    type: file
    path: src/codealmanac/runs/queue/service.py
    note: Queues init, ingest, and garden specs, spawns the hidden worker, and drains runs through lifecycle workflows.
  - id: page-run
    type: file
    path: src/codealmanac/engine/page_run/service.py
    note: Shows lifecycle workflows marking runs running, recording harness events, refreshing the index, and finishing runs.
  - id: cli-runs-parser
    type: file
    path: src/codealmanac/cli/parser/runs.py
    note: Defines the hidden `codealmanac runs` inspection command arguments as `run_id`.
  - id: cli-run-rendering
    type: file
    path: src/codealmanac/cli/render/runs.py
    note: Renders run records, logs, attach streams, and cancellation output with run terminology.
  - id: cli-lifecycle-rendering
    type: file
    path: src/codealmanac/cli/render/lifecycle.py
    note: Renders foreground and background lifecycle results with `run` and `run_id` fields.
  - id: cloud-runs
    type: file
    path: src/codealmanac/cloud/runs/
    note: Shows cloud-triggered executions keep the run noun outside the repo-local lifecycle run ledger.
  - id: local-runs
    type: file
    path: src/codealmanac/local/runs/
    note: Shows branch-triggered local control-plane executions keep the run noun outside the repo-local lifecycle run ledger.
  - id: engine-runs
    type: file
    path: src/codealmanac/engine/runs/
    note: Owns file-backed engine request and result artifacts under the engine package.
  - id: engine-workspaces
    type: file
    path: src/codealmanac/engine/workspaces/
    note: Owns detached per-run engine workspace paths and the Git worktree port.
  - id: engine-run-ids
    type: file
    path: src/codealmanac/engine/run_ids.py
    note: Defines engine-owned run ID validation so engine artifacts do not import local control-plane run IDs.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Guards the run ID and run-ledger persistence boundaries introduced by the rename.
status: active
verified: 2026-07-03
---

# Lifecycle Run Ledger

Repo-local lifecycle work in the Python codebase is recorded by a run ledger. `init`, `ingest`, `garden`, and sync-started ingest work produce `RunRecord` entries with `run_id` values, event logs, durable queued specs, cancellation, attach streaming, and worker locking under `src/codealmanac/runs/`. Cloud runs and branch-triggered local control-plane runs remain separate concepts under `src/codealmanac/cloud/runs/` and `src/codealmanac/local/runs/`. Engine run artifacts and engine workspaces are a third runtime-infrastructure domain under `src/codealmanac/engine/`, exposed through `app.engine`. [@slice-85-plan] [@slice-86-plan] [@run-models] [@cloud-runs] [@local-runs] [@engine-runs] [@engine-workspaces]

The page slug is historical. Treat this page as the current home for lifecycle runs and use run-shaped names for new repo-local lifecycle code.

## Boundary

`src/codealmanac/runs/ledger/` owns durable lifecycle observability. It defines `RunRecord`, `RunLogEvent`, `RunSpec`, `RunKind`, `RunStatus`, `RunStore`, and `RunLedgerService`; callers pass `run_id` through request objects. `src/codealmanac/runs/queue/` owns the single-writer background queue through `RunQueueWorkflow`. [@run-models] [@run-service] [@run-store] [@run-queue]

The composition root wires `RunLedgerService` as `app.runs` and passes that service to the viewer, init, ingest, garden, page-run workflow, sync workflow, and queue workflow. [@app-composition]

The run noun is still correct for three other domains. Cloud runs are hosted or cloud-parallel executions started through `codealmanac runs ...`; local runs are trigger-created branch executions managed by the local control plane; engine runs are request/result material for one model-worker execution. Engine run artifacts validate IDs through `src/codealmanac/engine/run_ids.py`, so engine storage does not import local control-plane ID types. [@cloud-runs] [@local-runs] [@engine-runs] [@engine-run-ids]

## Engine Runtime Boundary

`CodeAlmanacEngine` is the composition-root facade for reusable model-runtime services: harnesses, source discovery, source bundles, engine run artifacts, and engine workspaces. Local branch-triggered workflows call `app.engine.runs` and `app.engine.workspaces`; they do not own the request/result file format or the detached worktree layout. [@slice-86-plan] [@app-composition]

`src/codealmanac/engine/runs/` owns the `request.json` and `result.json` artifacts under `~/.codealmanac/runs/<run-id>/`. `src/codealmanac/engine/workspaces/` owns the per-run workspace layout under `~/.codealmanac/workspaces/<run-id>/`, including `repo/`, `sources/`, and `run/`, plus the service contract for preparing and removing detached workspaces. Git subprocess mechanics stay in the Git integration behind the `GitWorktreeManager` port. [@engine-runs] [@engine-workspaces] [@architecture-tests]

This boundary is why `src/codealmanac/local/runs/` still exists after Slice 86. Local runs coordinate trigger claiming, local engine execution, delivery, status, and worker orchestration; the engine package owns reusable runtime artifacts and workspace mechanics that a local or hosted worker can share. [@slice-86-plan] [@local-runs] [@app-composition]

## Storage

The configured `AppConfig.runs_path` is the primary lifecycle run storage root. `RunLedgerService.primary_run_dir()` maps a workspace to `<runs_path>/<workspace-id>` when that user-level path is configured; without it, the legacy repo-local path is the configured Almanac root's `runs/` directory. Reads check the primary path first and then the legacy repo-local path, which keeps older records visible without migrating them during read commands. [@run-service]

One run uses sibling files in its selected run directory:

```text
<run-id>.json
<run-id>.jsonl
<run-id>.spec.json
worker.lock/
```

`RunLedgerIO` writes JSON records and specs atomically, appends JSONL `RunLogEvent` rows, skips malformed persisted rows when reading, and leaves path construction to `runs/ledger/paths.py`. `paths.py` owns `RunId` validation at filesystem boundaries, while the store owns persistence behavior and status transitions. [@run-store] [@run-paths] [@architecture-tests]

## Lifecycle

A foreground lifecycle workflow starts a run record, marks it running through `PageRunWorkflow.begin()`, records mutation-policy and harness events, validates changed files, refreshes the SQLite index after a successful harness run, and finishes the run as `done` or `failed`. The workflow records harness transcript references when the adapter supplies them. [@page-run]

A background lifecycle workflow creates a queued run plus a durable `RunSpec`, spawns the hidden worker, and returns `run_id` plus the worker PID to the CLI. `RunQueueWorkflow.drain()` acquires the per-workspace worker lock, chooses the next queued spec-backed run, and calls the owning lifecycle workflow through `run_with_run(...)`. Missing specs fail the queued run instead of silently dropping it. [@run-queue] [@cli-lifecycle-rendering]

Terminal run statuses are `done`, `failed`, and `cancelled`. Cancelling a queued or running run writes a terminal cancelled transition; finishing a run that was already cancelled returns the cancelled record instead of resurrecting it. Attach streaming tails run log events until the record reaches a terminal status. [@run-models] [@run-store]

## CLI And Viewer

The public CLI name is `codealmanac`. The lifecycle runs inspection surface is the hidden admin command group `codealmanac runs`: list runs, `show <run-id>`, `logs <run-id>`, `attach <run-id>`, and `cancel <run-id>`. Parser arguments, renderers, background JSON, and sync summaries now use `run_id`. [@cli-runs-parser] [@cli-run-rendering] [@cli-lifecycle-rendering]

`codealmanac serve` uses the same `RunLedgerService` through the viewer service; run data for the local viewer is not reimplemented in a separate storage path. The runs page is a read surface over lifecycle run records and logs, not a second execution mechanism. [@app-composition]

## Naming Rule

Use `run` for repo-local lifecycle records, queue entries, logs, specs, locks, and inspection APIs. Use `run` for cloud executions, branch-triggered local control-plane executions, and engine execution artifacts only when the owning package is one of those run domains. Use `engine workspace` for detached model-worker worktrees; avoid reviving `worker_workspaces` as a package or public mental model.

This distinction is architectural, not cosmetic. It prevents future agents from comparing the local wiki maintenance ledger with hosted/cloud delivery runs as if they were the same product object, and it keeps model-runtime infrastructure out of the local control-plane package. [@slice-85-plan] [@slice-86-plan]
