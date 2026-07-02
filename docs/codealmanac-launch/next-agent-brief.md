# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 7 added the shared engine run artifact contract.

Implemented:

- `AppConfig.run_artifacts_path`, defaulting to `~/.codealmanac/runs`
- `app.engine_runs`
- `src/codealmanac/services/engine_runs/`
- typed `EngineRunRequest` and `EngineRunResult`
- `request.json` and `result.json` under
  `~/.codealmanac/runs/<run-id>/`
- pass-by-reference source fields: `sources_path` and `source_bundle_ref`
- `docs almanac:` commit subject validation

Verified:

```text
uv run pytest tests/test_engine_runs_service.py tests/test_architecture.py
uv run pytest
uv run ruff check .
git diff --check
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local trigger event recording through Git hooks
- public or hidden setup command that calls `app.local_hooks`
- local run storage bridge from repo-local job files to the control DB
- active-run cancellation/staling when branch head changes
- source bundle selection materialization for claimed runs
- local worker workspace creation using `app.engine_runs`
- delivery commit application from `EngineRunResult`

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice, update this brief, update `progress.md`, send a RelayForge
progress update, commit, and push.

## Known Repo State

The branch is `dev`. At the start of Slice 7 it was clean and even with
`origin/dev`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
