# CLI Inconsistency Ledger

This ledger records the launch CLI cleanup that removed old local-product
surfaces from the public command model.

## Status

Closed on 2026-07-04 in the CLI run-surface convergence pass.

The public CLI now has one cloud-first root command surface and one explicit
local namespace. The stale scheduled-sync/automation model is no longer a
launch-facing command path.

## Current Command Contract

Human-facing command surface:

```bash
codealmanac setup
codealmanac status
codealmanac login
codealmanac logout
codealmanac whoami
codealmanac open
codealmanac capture status
codealmanac capture enable
codealmanac capture disable
codealmanac capture inspect
codealmanac repo setup
codealmanac repo status
codealmanac repo open
codealmanac repo triggers list
codealmanac repo triggers enable <branch>
codealmanac repo triggers disable <branch>
codealmanac repo delivery set --branch <branch> --mode pr|commit
codealmanac repos list
codealmanac runs start
codealmanac runs list
codealmanac runs show <run-id>
codealmanac runs logs <run-id>
codealmanac local setup
codealmanac local status
codealmanac local triggers list
codealmanac local triggers enable <branch>
codealmanac local triggers disable <branch>
codealmanac local delivery set --branch <branch> --mode commit|working-tree
codealmanac local runs start
codealmanac local runs list
codealmanac local runs show <run-id>
codealmanac local runs logs <run-id>
```

Private process entrypoints:

```bash
codealmanac-local-trigger
codealmanac-local-worker
```

Git hooks and detached local workers call these process entrypoints directly.
They are intentionally not root `codealmanac` subcommands.

## Removed Breaking Surfaces

The following surfaces are removed from the parser, dispatch, render modules,
docs, and public contract:

- Root scheduled automation commands.
- Root sync commands.
- Local update commands.
- Local jobs commands.
- Hidden double-underscore root worker commands.
- Root setup automation flags.
- Root uninstall automation flags and JSON fields.

## Decisions Captured

- Root `codealmanac setup` is cloud setup plus agent instructions. It must not
  install local trigger hooks or local scheduled automation.
- Local setup is explicit: `codealmanac local setup`.
- Wiki-maintenance execution is named `runs` in both cloud and local command
  surfaces.
- Garden is a run kind, not a separate scheduled command.
- Local Git hook behavior records trigger events and drains ordinary local
  runs through the same control DB path.
- Root `codealmanac uninstall` removes setup-owned instruction files only. It
  does not delete local control DB state or run artifacts.

## Verification

- Focused gate passed: `uv run pytest tests/test_config_service.py tests/test_local_hooks.py tests/test_local_worker_spawner.py tests/test_local_runs_workflow.py tests/test_cli.py tests/test_public_contract.py tests/test_architecture.py -q` (`165 passed`).
- Full source gate passed: `uv run pytest -q` (`481 passed`).
- Lint and diff hygiene passed: `uv run ruff check .` and `git diff --check`.
- Stale-command search only finds historical launch logs and tests that
  intentionally reject old flags.
