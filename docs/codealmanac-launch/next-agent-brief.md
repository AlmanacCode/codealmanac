# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 11 added source bundle materialization.

Implemented:

- control DB verbs for sessions, turns, turn-branch links, and branch session
  selection
- `app.source_bundles`
- `sources/manifest.json`
- copied full session files under `sources/sessions/<provider>/`
- local run preparation that materializes source bundles before writing
  `request.json`

Verified:

```text
uv run pytest tests/test_control_service.py tests/test_source_bundles_service.py tests/test_local_run_preparation_workflow.py tests/test_architecture.py
uv run pytest
uv run ruff check .
git diff --check
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local trigger event recording through Git hooks
- public or hidden setup command that calls `app.local_hooks`
- local run storage bridge from repo-local job files to the control DB
- local model worker execution from prepared `EngineRunRequest`
- delivery commit application from `EngineRunResult`

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice, update this brief, update `progress.md`, send a RelayForge
progress update, commit, and push.

## Known Repo State

The branch is `dev`. At the start of Slice 11 it was clean and even with
`origin/dev`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
