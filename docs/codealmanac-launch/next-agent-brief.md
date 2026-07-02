# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 22 made `codealmanac init` the agent-backed first-build command and
removed public `codealmanac build`.

Implemented:

- `app.workflows.init.initialize_workspace(...)`
- `app.workflows.init.run(...)`
- `app.workflows.init.run_with_run(...)`
- `RunOperation.INIT`
- durable queued init specs
- `RunQueueWorkflow.queue_init(...)`
- `RunQueueWorkflow.start_init_background(...)`
- public `codealmanac init` first-build flags
- public `codealmanac build` parser removal
- diagnostics and starter README text pointing to `codealmanac init`

Verified:

```text
uv run pytest tests/test_init_workflow.py tests/test_cli.py tests/test_diagnostics.py tests/test_run_queue_workflow.py tests/test_runs_service.py tests/test_build_workflow.py tests/test_architecture.py
uv run pytest
uv run ruff check .
git diff --check
uv run codealmanac --help
uv run codealmanac init --help
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- finish the public launch CLI surface by hiding or dev-namespacing public
  `ingest` and `garden` while preserving internal workflows
- local run storage bridge from repo-local job files to the control DB, if
  needed for compatibility
- cloud public API/auth slice in `codealmanac-hosted`

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice, update this brief, update `progress.md`, send a RelayForge
progress update, commit, and push.

## Known Repo State

The branch is `dev`. At the end of Slice 22 verification it was ready to
commit on top of `origin/dev`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
