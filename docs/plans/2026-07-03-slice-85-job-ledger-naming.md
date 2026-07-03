# Slice 85: Job Ledger Naming

## Goal

Make repo-local lifecycle execution use the product noun `job` in code, not the
old internal noun `run`.

The branch-triggered local control plane keeps the noun `run`, because it
mirrors cloud runs: a trigger creates a run for a repository branch. The
repo-local lifecycle queue uses the noun `job`, because it is the user-visible
audit record for `init`, `ingest`, `garden`, and `sync`.

## Read Before Coding

- `MANUAL.md`
- `.almanac/README.md`
- `docs/python-port-live-agreement.md`
- `docs/reference/cosmic-python/chapter_06_uow.md`
- `docs/reference/cosmic-python/chapter_10_commands.md`
- `docs/refactor-audit-2026-07-03-hosted-local-architecture/refactor-roadmap.md`
- `docs/refactor-audit-2026-07-03-hosted-local-architecture/target-architecture.md`

## Current Problem

The code currently has all of these names:

```text
services/runs          # repo-local lifecycle jobs
workflows/run_queue    # repo-local lifecycle job queue
local/runs             # branch-triggered local control-plane runs
cloud/runs             # cloud runs
engine_runs            # request/result artifacts for one engine execution
```

The first two are not cloud/local-parallel runs. They are the local wiki job
ledger and the per-wiki single-writer job queue. Keeping them as `runs` makes
future agents compare the wrong concepts.

## Target Shape

```text
src/codealmanac/jobs/
  ledger/
    models.py      # JobRecord, JobLogEvent, JobSpec, JobStatus
    requests.py    # StartJobRequest, FinishJobRequest, ...
    store.py       # JobStore
    service.py     # JobLedgerService
    ...
  queue/
    models.py      # JobQueueStartResult
    requests.py    # DrainJobQueueRequest
    service.py     # JobQueueWorkflow

src/codealmanac/local/runs/
  ...              # branch-triggered local/cloud-parallel runs stay here
```

Wireframe:

```python
job = app.jobs.start(StartJobRequest(...))
app.jobs.record_event(RecordJobEventRequest(job_id=job.job_id, ...))
app.jobs.finish(FinishJobRequest(job_id=job.job_id, status=JobStatus.DONE))

queued = app.workflows.job_queue.queue_ingest(request)
app.workflows.job_queue.drain(DrainJobQueueRequest(...))

local_run = app.local.run_preparation.prepare_next()
app.local.engine.execute(...)
app.local.delivery.deliver(...)
```

## Scope

- Move `services/runs` to `jobs/ledger`.
- Move `workflows/run_queue` to `jobs/queue`.
- Rename internal types from `Run*` to `Job*` for this repo-local lifecycle
  surface.
- Rename request fields from `run_id` to `job_id` inside the job ledger.
- Keep persisted file extension and layout under the configured jobs path.
- Keep public CLI command `codealmanac jobs`.
- Keep hidden worker command behavior.
- Preserve old top-level `app.runs` only as a temporary compatibility facade if
  existing wiring still needs it during the slice; prefer new `app.jobs`.

## Out Of Scope

- Do not rename cloud runs.
- Do not rename local control-plane run tables.
- Do not change trigger, delivery, or worker semantics.
- Do not add a migration layer for old persisted job records; launch has no
  compatibility requirement.

## Verification

Focused:

```bash
uv run ruff check src tests
uv run pytest tests/test_runs_service.py tests/test_run_queue_workflow.py tests/test_cli.py tests/test_sync_workflow.py tests/test_init_workflow.py tests/test_ingest_workflow.py tests/test_garden_workflow.py tests/test_architecture.py -q --tb=short
```

Full gate:

```bash
uv run pytest -q --tb=short
git diff --check
```

## Result

- Implemented `src/codealmanac/jobs/ledger/` and
  `src/codealmanac/jobs/queue/`.
- Removed the old `src/codealmanac/services/runs/` and
  `src/codealmanac/workflows/run_queue/` source modules.
- Renamed lifecycle job IDs from `run_id` to `job_id` across services, CLI,
  sync, maintenance, viewer/server API, and tests.
- Kept cloud runs and branch-triggered local runs on the `run` noun.
- Added `src/codealmanac/engine/run_ids.py` so engine artifact stores do not
  import local control-plane ID types.
- Focused verification passed: `217 passed`.
- Full verification passed: `uv run ruff check src tests`,
  `uv run pytest -q --tb=short` (`513 passed`), and `git diff --check`.

## Documentation Updates

- Update launch worklog/progress/next-agent brief.
- Update refactor audit target architecture and roadmap.
- Mention the rule: repo-local lifecycle records are jobs; cloud/local
  trigger records are runs.
