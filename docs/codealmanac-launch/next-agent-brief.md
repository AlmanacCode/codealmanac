# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 1 created the local control DB foundation in `codealmanac`.

Implemented:

- `~/.codealmanac/control.sqlite` as `AppConfig.control_db_path`
- `app.control` in the composition root
- `src/codealmanac/services/control/`
- launch control tables for repositories, branches, sessions, turns,
  turn-branch joins, trigger events, runs, run events, and deliveries
- focused control DB and architecture tests

Verified:

```text
uv run pytest tests/test_control_service.py tests/test_database.py tests/test_architecture.py
git diff --check
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local trigger event recording through Git hooks
- local run storage bridge from repo-local job files to the control DB
- engine request/result models used by local and hosted workers

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice and update this brief.

## Known Repo State

The branch is `dev` and is behind `origin/dev` by one commit. Rebase or merge
before pushing if Git requires it.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
