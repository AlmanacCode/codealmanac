# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 3 added the hidden local trigger dispatcher that Git hooks will call.

Implemented:

- `LocalGitStateProbe` control port
- concrete Git probe for repository root, branch, and HEAD SHA
- `ControlService.record_current_git_trigger`
- repository-root lookup against `repositories.local_root_path`
- hidden CLI command:
  `codealmanac __record-local-trigger --kind local_post_commit --cwd "$PWD"`
- silent default output and `--json` debug output

Verified:

```text
uv run pytest tests/test_control_service.py tests/test_git_workspace_probe.py tests/test_cli.py tests/test_architecture.py
uv run ruff check .
git diff --check
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local trigger event recording through Git hooks
- Git hook installation/repair/removal for `post-commit`, `post-merge`, and
  `post-rewrite`
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
