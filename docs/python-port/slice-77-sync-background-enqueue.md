# Slice 77 - Sync Background Enqueue

Date: 2026-07-01

## Scope

Let `sync` use the background run machinery without changing its default
foreground behavior:

- explicit sync execution mode
- `sync --background`
- pending ledger claims linked to queued run ids
- queued Ingest specs for eligible transcript ranges
- worker spawning through `RunQueueWorkflow`
- status/reconciliation continues to treat queued/running linked runs as active

This slice does **not** change scheduled automation defaults. Automation still
launches foreground `sync` until the unattended policy is reopened explicitly.

## Why Now

The live agreement says sync can enqueue ingest work once background jobs
exist. Slices 75 and 76 implemented spec-backed queueing, worker locks, worker
drain, and public background lifecycle mode. Sync is now the remaining place
where background jobs are relevant but unused.

## Decisions

- Keep transcript discovery, cursor decisions, and pending ledger ownership in
  `SyncWorkflow`.
- Inject `RunQueueWorkflow` into `SyncWorkflow` so sync can enqueue Ingest
  through the same operation path as public `ingest --background`.
- Do not let sync shell out to `codealmanac`.
- Keep plain `codealmanac sync` foreground. Add `codealmanac sync --background`
  for queue-and-spawn behavior.
- Reuse the existing `SyncStarted` output shape. A background sync started item
  still means "a run was started for this transcript range"; the run status may
  be `queued` at print time.

## Shape

```python
summary = app.workflows.sync.run(
    RunSyncRequest(..., execution=SyncExecution.BACKGROUND)
)
```

For each eligible transcript:

```python
queued = queue.queue_ingest(ingest_request)
ledger.sessions[key] = pending_entry(..., queued.run_id)
queue.spawn_worker(repo_root, wiki)
```

Foreground remains:

```python
run = ingest.start(...)
ledger.sessions[key] = pending_entry(..., run.run_id)
ingest.run_with_run(...)
ledger.sessions[key] = absorbed_entry(...)
```

## Cosmic Python Transfer

Chapter 10 separates command intent from events. `sync --background` is a
different command intent from foreground sync, so it belongs in the request
model rather than hidden behind scheduler or CLI conditionals.

Chapter 4 keeps use-case orchestration in services/workflows. `SyncWorkflow`
should decide what to enqueue because it owns transcript eligibility; the queue
workflow should only execute the operation spec.

## Files

- `src/codealmanac/workflows/sync/models.py`
- `src/codealmanac/workflows/sync/requests.py`
- `src/codealmanac/workflows/sync/service.py`
- `src/codealmanac/app.py`
- `src/codealmanac/cli/parser/lifecycle.py`
- `src/codealmanac/cli/dispatch/lifecycle.py`
- `README.md`
- `tests/test_sync_workflow.py`
- `tests/test_cli.py`
- `tests/test_public_contract.py`

## Verification

Focused:

```bash
uv run pytest tests/test_sync_workflow.py tests/test_cli.py tests/test_public_contract.py
uv run ruff check src/codealmanac/workflows/sync src/codealmanac/cli src/codealmanac/app.py tests/test_sync_workflow.py tests/test_cli.py tests/test_public_contract.py
```

Broad:

```bash
uv run pytest
uv run ruff check .
git diff --check
```
