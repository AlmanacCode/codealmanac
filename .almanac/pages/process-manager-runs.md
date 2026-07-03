---
title: Lifecycle Job Ledger
summary: Repo-local lifecycle work is recorded as jobs under `codealmanac.jobs`, while cloud and local trigger executions keep the run noun.
topics:
  - systems
  - storage
  - cli
  - agents
sources:
  - id: slice-85-plan
    type: file
    path: docs/plans/2026-07-03-slice-85-job-ledger-naming.md
    note: Records the accepted Slice 85 boundary: lifecycle records are jobs, cloud/local trigger executions remain runs.
  - id: app-composition
    type: file
    path: src/codealmanac/app.py
    note: Wires `JobLedgerService` and `JobQueueWorkflow` through the composition root as `app.jobs` and `app.workflows.queue`.
  - id: job-models
    type: file
    path: src/codealmanac/jobs/ledger/models.py
    note: Defines `JobRecord`, `JobLogEvent`, `JobSpec`, `JobOperation`, `JobStatus`, and `job_id` validation.
  - id: job-service
    type: file
    path: src/codealmanac/jobs/ledger/service.py
    note: Resolves workspaces and owns lifecycle job listing, showing, logging, attaching, queueing, locking, and cancellation.
  - id: job-store
    type: file
    path: src/codealmanac/jobs/ledger/store.py
    note: Owns job record/spec/log persistence and status transitions over file-backed job directories.
  - id: job-paths
    type: file
    path: src/codealmanac/jobs/ledger/paths.py
    note: Defines current job artifact names and centralizes `JobId` path validation.
  - id: job-queue
    type: file
    path: src/codealmanac/jobs/queue/service.py
    note: Queues init, ingest, and garden specs, spawns the hidden worker, and drains jobs through lifecycle workflows.
  - id: page-run
    type: file
    path: src/codealmanac/engine/page_run/service.py
    note: Shows lifecycle workflows marking jobs running, recording harness events, refreshing the index, and finishing jobs.
  - id: cli-jobs-parser
    type: file
    path: src/codealmanac/cli/parser/jobs.py
    note: Defines the hidden `codealmanac jobs` inspection command arguments as `job_id`.
  - id: cli-job-rendering
    type: file
    path: src/codealmanac/cli/render/jobs.py
    note: Renders job records, logs, attach streams, and cancellation output with job terminology.
  - id: cli-lifecycle-rendering
    type: file
    path: src/codealmanac/cli/render/lifecycle.py
    note: Renders foreground and background lifecycle results with `job` and `job_id` fields.
  - id: cloud-runs
    type: file
    path: src/codealmanac/cloud/runs/
    note: Shows cloud-triggered executions keep the run noun outside the repo-local lifecycle job ledger.
  - id: local-runs
    type: file
    path: src/codealmanac/local/runs/
    note: Shows branch-triggered local control-plane executions keep the run noun outside the repo-local lifecycle job ledger.
  - id: engine-run-ids
    type: file
    path: src/codealmanac/engine/run_ids.py
    note: Defines engine-owned run ID validation so engine artifacts do not import local control-plane run IDs.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Guards the job ID and job-ledger persistence boundaries introduced by the rename.
status: active
verified: 2026-07-03
---

# Lifecycle Job Ledger

Repo-local lifecycle work in the Python codebase is a job ledger, not a run subsystem. `init`, `ingest`, `garden`, and sync-started ingest work produce `JobRecord` entries with `job_id` values, event logs, durable queued specs, cancellation, attach streaming, and worker locking under `src/codealmanac/jobs/`. Cloud runs and branch-triggered local control-plane runs remain separate concepts under `src/codealmanac/cloud/runs/` and `src/codealmanac/local/runs/`. [@slice-85-plan] [@job-models] [@cloud-runs] [@local-runs]

The page slug is historical. Treat this page as the current home for lifecycle jobs, not as evidence that new repo-local lifecycle code should use run-shaped names.

## Boundary

`src/codealmanac/jobs/ledger/` owns durable lifecycle observability. It defines `JobRecord`, `JobLogEvent`, `JobSpec`, `JobOperation`, `JobStatus`, `JobStore`, and `JobLedgerService`; callers pass `job_id` through request objects rather than `run_id`. `src/codealmanac/jobs/queue/` owns the single-writer background queue through `JobQueueWorkflow`. [@job-models] [@job-service] [@job-store] [@job-queue]

The composition root wires `JobLedgerService` as `app.jobs` and passes that service to the viewer, init, ingest, garden, page-run workflow, sync workflow, and queue workflow. There is no current `app.runs` facade for this repo-local lifecycle surface. [@app-composition]

The run noun is still correct for two other domains. Cloud runs are hosted or cloud-parallel executions started through `codealmanac runs ...`; local runs are trigger-created branch executions managed by the local control plane. Engine run artifacts are request/result material for one engine execution and now validate their IDs through `src/codealmanac/engine/run_ids.py`, so engine storage does not import local control-plane ID types. [@cloud-runs] [@local-runs] [@engine-run-ids]

## Storage

The configured `AppConfig.jobs_path` is the primary lifecycle job storage root. `JobLedgerService.primary_job_dir()` maps a workspace to `<jobs_path>/<workspace-id>` when that user-level path is configured; without it, the legacy repo-local path is the configured Almanac root's `jobs/` directory. Reads check the primary path first and then the legacy repo-local path, which keeps older records visible without migrating them during read commands. [@job-service]

One job uses sibling files in its selected job directory:

```text
<job-id>.json
<job-id>.jsonl
<job-id>.spec.json
worker.lock/
```

`JobLedgerIO` writes JSON records and specs atomically, appends JSONL `JobLogEvent` rows, skips malformed persisted rows when reading, and leaves path construction to `jobs/ledger/paths.py`. `paths.py` owns `JobId` validation at filesystem boundaries, while the store owns persistence behavior and status transitions. [@job-store] [@job-paths] [@architecture-tests]

## Lifecycle

A foreground lifecycle workflow starts a job record, marks it running through `PageRunWorkflow.begin()`, records mutation-policy and harness events, validates changed files, refreshes the SQLite index after a successful harness run, and finishes the job as `done` or `failed`. The workflow records harness transcript references when the adapter supplies them. [@page-run]

A background lifecycle workflow creates a queued job plus a durable `JobSpec`, spawns the hidden worker, and returns `job_id` plus the worker PID to the CLI. `JobQueueWorkflow.drain()` acquires the per-workspace worker lock, chooses the next queued spec-backed job, and calls the owning lifecycle workflow through `run_with_job(...)`. Missing specs fail the queued job instead of silently dropping it. [@job-queue] [@cli-lifecycle-rendering]

Terminal job statuses are `done`, `failed`, and `cancelled`. Cancelling a queued or running job writes a terminal cancelled transition; finishing a job that was already cancelled returns the cancelled record instead of resurrecting it. Attach streaming tails job log events until the record reaches a terminal status. [@job-models] [@job-store]

## CLI And Viewer

The public CLI name is `codealmanac`. The lifecycle jobs inspection surface is the hidden admin command group `codealmanac jobs`: list jobs, `show <job-id>`, `logs <job-id>`, `attach <job-id>`, and `cancel <job-id>`. Parser arguments, renderers, background JSON, and sync summaries now use `job_id`. [@cli-jobs-parser] [@cli-job-rendering] [@cli-lifecycle-rendering]

`codealmanac serve` uses the same `JobLedgerService` through the viewer service; job data for the local viewer is not reimplemented in a separate storage path. The jobs page is a read surface over lifecycle job records and logs, not a second execution mechanism. [@app-composition]

## Naming Rule

Use `job` for repo-local lifecycle records, queue entries, logs, specs, locks, and inspection APIs. Use `run` for cloud executions, branch-triggered local control-plane executions, and engine execution artifacts only when the owning package is one of those run domains.

This distinction is architectural, not cosmetic. It prevents future agents from comparing the local wiki maintenance ledger with hosted/cloud delivery runs as if they were the same product object. [@slice-85-plan]
