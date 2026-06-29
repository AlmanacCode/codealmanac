# Slice 53 - Registry List Management

Date: 2026-06-29

## Scope

Make `codealmanac list` useful as a local wiki management surface, not only a
registry dump.

This slice adds:

- `codealmanac list --json` for machine-readable registry state
- `codealmanac list --drop <selector>` for explicit one-wiki removal
- `codealmanac list --drop-missing` for explicit removal of unreachable entries

## Non-Goals

- No automatic pruning during `search`, `show`, `serve`, `doctor`, or `list`.
- No hosted workspace/account list.
- No sticky `use` state.
- No migration from old `.almanac/` repos unless a user explicitly initializes
  or registers that root.

## Design

Registry cleanup is a service use case, not CLI string surgery:

```python
items = workspaces.list_registry()
drop = workspaces.drop(DropWorkspaceRequest(selector="old-repo"))
missing = workspaces.drop_missing()
```

`WorkspaceRegistryStatus` distinguishes:

- `available` - repo path and configured Almanac root both exist
- `missing_repo` - registered repo path is gone
- `missing_almanac` - repo path exists, but the configured Almanac root is gone

Plain `codealmanac list` keeps the old three-column output. JSON includes the
status. Cleanup commands print only what they drop.

## Tests

- service-level registry status and missing-entry cleanup
- service-level selected entry drop
- CLI plain list remains stable
- CLI JSON reports status
- CLI drop removes a selected wiki
- CLI drop-missing removes unreachable entries and keeps available entries

## Verification

Initial focused gate:

```bash
uv run pytest tests/test_build_workflow.py::test_workspace_registry_reports_and_drops_missing_wikis tests/test_build_workflow.py::test_workspace_registry_drops_selected_wiki tests/test_cli.py::test_cli_list_json_reports_registry_status tests/test_cli.py::test_cli_list_drop_removes_selected_wiki tests/test_cli.py::test_cli_list_drop_missing_removes_unreachable_wikis -q
uv run ruff check src/codealmanac/services/workspaces src/codealmanac/cli tests/test_build_workflow.py tests/test_cli.py
```

Result: 5 tests passed; focused ruff passed.

Full gate:

```bash
uv run pytest
uv run ruff check .
git diff --check
uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice53
```

Result: 234 tests passed; full ruff passed; diff hygiene passed; wheel built
as `codealmanac-0.1.0-py3-none-any.whl`. Wheel inspection confirmed
`codealmanac/services/workspaces/service.py`,
`codealmanac/cli/parser/wiki.py`, and `codealmanac/cli/render/root.py`.

Live dogfood used isolated temp registries:

```bash
codealmanac init <live-repo> --name live
codealmanac init <missing-repo> --name missing
rm -rf <missing-repo>
codealmanac list --json
codealmanac list --drop-missing
codealmanac list
codealmanac list --drop drop-me
```

Result: JSON reported `live` as `available` and `missing` as `missing_repo`;
`--drop-missing` removed only the missing entry; `list` kept the live entry;
`--drop drop-me` removed the selected entry and left an empty registry.
