# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 6 added trigger claiming into queued control runs.

Implemented:

- `app.control.claim_next_trigger(...)`
- pending trigger selection with optional repository/branch scope
- trigger transition from `pending` to `claimed`
- `claimed_at` timestamp
- queued control run creation
- `expected_head_sha` copied from the claimed trigger's `head_sha`

Verified:

```text
uv run pytest tests/test_control_service.py tests/test_architecture.py
uv run ruff check .
git diff --check
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local trigger event recording through Git hooks
- public or hidden setup command that calls `app.local_hooks`
- local run storage bridge from repo-local job files to the control DB
- active-run cancellation/staling when branch head changes
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
