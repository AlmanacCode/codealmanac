# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 23 removed manual `ingest` and `garden` from the normal public top-level
CLI and moved them under hidden `codealmanac dev`.

Implemented:

- hidden `codealmanac dev ingest <inputs...>`
- hidden `codealmanac dev garden`
- top-level parser/dispatch removal for `ingest` and `garden`
- root argparse help filtering for `argparse.SUPPRESS` subcommands
- README/public-contract examples for public local setup/update commands
- architecture tests pinning `dev` as its own parser/dispatch domain

Verified:

```text
uv run pytest tests/test_cli.py tests/test_architecture.py
uv run pytest tests/test_public_contract.py tests/test_cli.py tests/test_architecture.py
uv run pytest
uv run ruff check .
git diff --check
uv run codealmanac --help
uv run codealmanac dev ingest --help
uv run codealmanac dev garden --help
```

## Next Pressure Test

Choose the next substantial slice from the launch plan. Good candidates:

- local run storage bridge from repo-local job files to the control DB, if
  needed for compatibility
- cloud public API/auth slice in `codealmanac-hosted`

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice, update this brief, update `progress.md`, send a RelayForge
progress update, commit, and push.

## Known Repo State

The branch is `dev`. Slice 23 implementation commit `a58bdc43` is pushed to
`origin/dev`. Start from the latest `origin/dev`, which includes the Slice 23
bookkeeping commit once this brief is committed and pushed.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
