# Worklog

## 2026-07-06

- Started from `f2eb2c7a1ac56c913d4a44ab24d5c3a2b553007c` on branch
  `codex/macro-refactor-from-f2eb2c7`.
- Removed an accidental temporary worktree and continued in the main checkout
  as requested.
- Read the active build rules in `MANUAL.md`.
- Read the wiki front door and style pages under `almanac/style/`.
- Read the active live agreement in `docs/python-port-live-agreement.md`.
- Read local Cosmic Python notes and the project-structure appendix.
- Ran baseline gates:
  - `uv run pytest`: 401 passed.
  - `uv run ruff check .`: passed.
- Captured initial size pressure:
  - `src/codealmanac/cli/render/setup.py`: 612 lines.
  - `src/codealmanac/app.py`: 255 lines.
  - `src/codealmanac/integrations/harnesses/codex/app_server.py`: 238 lines.
  - `src/codealmanac/workflows/sync/execution.py`: 232 lines.
  - `src/codealmanac/workflows/sync/evaluation.py`: 230 lines.
  - `src/codealmanac/services/runs/store.py`: 228 lines.
- Found that many facade modules are intentional and documented in the live
  agreement. This audit should not blindly delete them.
- Found a live-agreement tension: an older config section says not to add a
  public `config` command, while the current CLI, tests, and README expose
  `codealmanac config set`. This is recorded in `product-slop.md` instead of
  being changed during refactor.

## Current Pressure Points

- `cli/render/setup.py` mixes terminal art, interactive choice screens,
  ANSI-card layout helpers, setup result rendering, and uninstall Rich panels.
- `app.py` wires every concrete dependency directly in one function. It is
  still honest as the composition root, but it is becoming hard to scan.
- Architecture tests are useful, but many assert exact files and fragments.
  During refactor they should describe boundaries, not fossilize accidental
  names.
- Several product behaviors now exist because they are tested and documented,
  not because the live agreement explains their final product value clearly.
  These belong in `product-slop.md`.

## First Refactor Batch: Setup Render Split

- Wrote `docs/plans/2026-07-06-setup-render-refactor.md`.
- Split `src/codealmanac/cli/render/setup.py` by reason to change:
  - `brand.py` owns banner/color/product-label constants and banner output.
  - `terminal.py` owns ANSI-aware width, wrapping, card rows, and shell command
    rendering.
  - `setup_screens.py` owns interactive setup choice screens.
  - `setup_panels.py` owns Rich uninstall panels.
  - `setup.py` now owns setup-result text rendering and setup step facts.
- Updated `src/codealmanac/cli/dispatch/setup_tui.py` to import interactive
  setup screen types from `setup_screens.py`.
- Updated `tests/test_architecture.py` so the CLI admin render boundary guards
  the new split and caps `setup.py`.
- Size evidence after split:
  - `setup.py`: 225 lines, down from 612.
  - `setup_screens.py`: 182 lines.
  - `setup_panels.py`: 105 lines.
  - `brand.py`: 75 lines.
  - `terminal.py`: 74 lines.
- Verification:
  - `uv run pytest tests/test_cli.py tests/test_setup_service.py tests/test_architecture.py -q`: 114 passed.
  - `uv run ruff check src/codealmanac/cli/render src/codealmanac/cli/dispatch/setup_tui.py tests/test_cli.py tests/test_setup_service.py tests/test_architecture.py`: passed.
  - `uv run pytest`: 401 passed.
  - `uv run ruff check .`: passed.
  - `git diff --check`: passed after removing one final blank line.

## Second Refactor Batch: App Composition Root

- Wrote `docs/plans/2026-07-06-app-composition-refactor.md`.
- Kept `src/codealmanac/app.py` as the public composition root.
- Split the long `create_app()` body into private helpers:
  - `_create_services(...)` wires service objects and concrete adapter defaults.
  - `_create_page_run(...)` owns the repeated page-run policy construction.
  - `_create_workflows(...)` wires build, ingest, garden, queue, and sync.
  - `_create_app(...)` assembles the public `CodeAlmanac` object.
- Added `tests/test_architecture.py::test_app_composition_root_stays_scannable`
  so the public factory does not regrow into one dense wiring function.
- Size evidence after split:
  - `create_app()`: 34 lines, down from 149.
  - `_create_services(...)`: 77 lines.
  - `_create_workflows(...)`: 55 lines.
- Verification:
  - `uv run pytest tests/test_architecture.py::test_app_composition_root_stays_scannable tests/test_cli.py::test_cli_help_includes_update tests/test_config_service.py -q`: 10 passed.
  - `uv run ruff check src/codealmanac/app.py tests/test_architecture.py`: passed.
  - `uv run pytest`: 402 passed.
  - `uv run ruff check .`: passed.
  - `git diff --check`: passed.

## Third Refactor Batch: Sync Execution Ledger Writes

- Wrote `docs/plans/2026-07-06-sync-execution-refactor.md`.
- Kept `workflows/sync/execution.py` as the owner of sync execution effects.
- Extracted repeated ledger-entry writes inside `SyncRunExecutor`:
  - `_claim_pending(...)` writes the pending claim and returns the pending
    work item.
  - `_record_failure(...)` writes failed ledger state and the needs-attention
    row.
  - `_save_entry(...)` owns the shared ledger-store save call for one sync
    item.
- `run_background_item(...)` and `run_foreground_item(...)` now read as
  orchestration steps instead of repeating ledger mutation mechanics.
- Verification:
  - `uv run pytest tests/test_sync_workflow.py -q`: 20 passed.
  - `uv run ruff check src/codealmanac/workflows/sync/execution.py tests/test_sync_workflow.py`: passed.
  - `uv run pytest`: 402 passed.
  - `uv run ruff check .`: passed.
  - `git diff --check`: passed.

## Fourth Refactor Batch: Raw Input Types

- Wrote `docs/plans/2026-07-06-raw-input-types-refactor.md`.
- Replaced production `typing.Any` annotations in raw parser/validator
  boundaries with `object`.
- Touched raw input boundaries only:
  - config duration parsing;
  - source-shape validation;
  - tag/topic request validators;
  - wiki frontmatter and topics YAML parsing;
  - workspace registry JSON parsing.
- Added `RawSource` in `services/wiki/frontmatter.py` for parsed source maps.
- Verification:
  - `rg -n "\bAny\b|dict\[str, Any\]|dict\[Any" src/codealmanac`: no output.
  - `uv run pytest tests/test_wiki_parsing.py tests/test_read_model.py tests/test_config_service.py tests/test_topics_mutation.py tests/test_tagging.py tests/test_topics_health.py tests/test_workspace_registry_store.py tests/test_validate.py -q`: 59 passed.
  - `uv run ruff check ...`: passed for touched files and focused tests.
  - `uv run pytest`: 402 passed.
  - `uv run ruff check .`: passed.
  - `git diff --check`: passed.

## Fifth Refactor Batch: Codex Event Dispatcher

- Wrote `docs/plans/2026-07-06-codex-event-dispatch-refactor.md`.
- Kept `src/codealmanac/integrations/harnesses/codex/events.py` as the
  notification dispatcher named in the live agreement.
- Extracted notification helper logic into
  `src/codealmanac/integrations/harnesses/codex/notification_events.py`:
  - text and plan deltas;
  - plan updates;
  - command/file output deltas;
  - warnings;
  - errors.
- `map_codex_notification(...)` is now 57 lines, down from 100, and
  `events.py` is 100 lines total.
- Updated the architecture test so `events.py` cannot regrow event-kind or
  failure classification details.
- Verification:
  - `uv run pytest tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py -q`: 11 passed.
  - `uv run ruff check src/codealmanac/integrations/harnesses/codex/events.py tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py`: passed.
  - `uv run pytest tests/test_architecture.py::test_codex_app_server_event_mapper_stays_split_by_responsibility tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py -q`: 12 passed.
  - `uv run pytest`: 402 passed.
  - `uv run ruff check .`: passed.
  - `git diff --check`: passed.
