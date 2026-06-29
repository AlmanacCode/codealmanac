# Slice 40 - CLI Edge Split

## Scope

Split the oversized CLI edge without changing the public command surface.

This slice keeps `argparse`. Python's standard parser already supports
subcommands, and changing to Click or Typer would be a user-visible parser
migration rather than a structural cleanup.

## Shape

```text
src/codealmanac/cli/
  main.py              process entrypoint and error formatting
  parser/
    root.py            root parser composer
    lifecycle.py       init/build/ingest/garden/sync
    wiki.py            list/search/show/topics/health/reindex/serve/tag/untag
    admin.py           doctor/update/jobs/automation
  dispatch/
    root.py            parsed command to service/workflow requests
  render/
    root.py            stdout/stderr rendering helpers
```

## Decisions

- `main.py` stays a thin process edge: parse, call dispatch, format known
  errors.
- Parser construction is split by command domain and guarded by architecture
  tests.
- Dispatch and render are separated from `main.py`, but still broad. Split
  them by command domain only when a later CLI change creates real pressure.
- Tests continue to import `build_parser` and `main` from
  `codealmanac.cli.main`, so the public Python entrypoint remains stable.

## Verification

Run:

```bash
uv run pytest tests/test_architecture.py tests/test_cli.py tests/test_public_contract.py
uv run ruff check src/codealmanac/cli tests/test_architecture.py tests/test_cli.py tests/test_public_contract.py
uv run pytest
uv run ruff check .
git diff --check
```
