# Slice 89: Serve Jobs View

## Scope

Restore a read-only jobs surface in the local viewer so humans and agents can
inspect lifecycle runs and normalized harness events through `codealmanac serve`.

This slice changes:

- `ViewerService` read models and requests for jobs list/detail.
- FastAPI routes for `/api/jobs` and `/api/jobs/{run_id}`.
- Static viewer routes for `#/jobs` and `#/jobs/<run-id>`.
- Focused viewer/server tests for run records and normalized harness events.
- Steering docs and verification records.

## Why

The Python rewrite now has durable run records, attach/cancel, background jobs,
and normalized harness event logs. The CLI can inspect them, but the local
viewer cannot. The archived viewer exposed jobs because run transcripts are
part of the product's inspectability contract.

Cosmic Python chapter 12 says, "reads and writes are different." This is a
read-side slice: `serve` should answer questions about existing run state
without adding write controls, queue mutations, polling, or provider logic.

## Shape

```python
jobs = app.viewer.jobs(ViewerJobsRequest(cwd=repo, wiki=wiki))
detail = app.viewer.job(ViewerJobRequest(cwd=repo, wiki=wiki, run_id=run_id))
```

The server adapts HTTP to those service calls. The browser renders returned DTOs.
Run storage, status transitions, attach, and cancel remain owned by
`RunsService` and the CLI/admin command surface.

## Out Of Scope

- No browser cancel button.
- No live polling.
- No job log projection/grouping as rich as the archived TypeScript viewer.
- No raw provider transcript file browser.
- No changes to run lifecycle semantics.

## Verification

- Focused viewer service and server tests.
- Focused architecture/static asset tests where needed.
- Live `serve` dogfood against a temp repo with a synthetic run log.
- Full `uv run pytest`, `uv run ruff check .`, and `git diff --check`.
