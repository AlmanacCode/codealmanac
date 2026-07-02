# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 16 connected local Git hooks to detached local worker spawning.

Implemented:

- `SpawnLocalWorkerRequest`
- `LocalWorkerSpawner` port
- `SubprocessLocalWorkerSpawner`
- `codealmanac __record-local-trigger --spawn-worker`
- Git hook blocks now include `--spawn-worker`
- spawn path starts `codealmanac __run-local-worker` for the recorded
  repository and branch

Verified:

```text
uv run pytest tests/test_cli.py tests/test_local_hooks.py tests/test_local_worker_spawner.py tests/test_architecture.py
uv run pytest
uv run ruff check .
git diff --check
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local trigger event recording through Git hooks
- public or hidden setup command that calls `app.local_hooks`
- local run storage bridge from repo-local job files to the control DB
- setup/local command surface that installs hooks and branch policy
- prompt restoration / first-build `init` path from
  `docs/codealmanac-launch/init-first-build-prompt-restoration.md`

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice, update this brief, update `progress.md`, send a RelayForge
progress update, commit, and push.

## Known Repo State

The branch is `dev`. At the end of Slice 16 verification it was ready to
commit on top of `origin/dev`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
