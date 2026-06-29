# Slice 34 - Manual Surface

## Scope

Add the local manual surface promised by the target Python package shape without
adding a new public CLI command.

This slice makes the manual concrete in three places:

- packaged Markdown resources under `src/codealmanac/manual/`
- workspace materialization under `.almanac/manual/` during `init` and `build`
- `doctor` checks for bundled manual availability and workspace manual presence

## Non-Goals

- No hosted manual sync.
- No public `codealmanac manual` command.
- No source catalog or source-pool behavior.
- No overwrite of local manual edits during ordinary `build`.

## Design

`ManualLibrary` is a support-package boundary, like `PromptRenderer`. It reads
package resources, installs missing workspace files, and reports workspace
manual completeness.

`app.py` constructs `ManualLibrary` once and injects it into `WikiService` and
`DiagnosticsService`. CLI code does not locate package resources directly.

`WikiService.initialize(...)` copies missing manual files into
`.almanac/manual/` and preserves existing files. This keeps `build` idempotent
and prevents local edits from being overwritten by a maintenance command.

`DiagnosticsService.check(...)` reports:

- `install.manual` for package resource availability
- `wiki.manual` for the selected workspace's `.almanac/manual/` files

The lifecycle prompts now tell agents to read the operation-specific manual
files before editing the wiki.

## Tests

- manual library inventory, document validation, and missing-file install
- build initializes `.almanac/manual/` and preserves existing manual files
- doctor reports manual package and workspace manual status
- prompt rendering includes the updated manual guidance

## Verification

Initial focused gate:

```bash
uv run pytest tests/test_manual.py tests/test_build_workflow.py tests/test_diagnostics.py tests/test_cli.py::test_cli_doctor_reports_local_state tests/test_prompts.py
uv run ruff check src/codealmanac/manual src/codealmanac/app.py src/codealmanac/services/wiki/service.py src/codealmanac/services/diagnostics/service.py tests/test_manual.py tests/test_build_workflow.py tests/test_diagnostics.py tests/test_cli.py
```

Result: 14 tests passed; focused ruff passed.

Full verified gate:

```bash
uv run pytest
uv run ruff check .
git diff --check
uv build --out-dir /tmp/codealmanac-build-slice34-*
```

Result: 169 tests passed; full ruff passed; diff hygiene passed; wheel
inspection confirmed `codealmanac/manual/*.md`, manual Python modules, prompt
Markdown, and the `codealmanac` entry point.

Live dogfood used an isolated temp repo and temp `HOME`:

```bash
codealmanac build <repo> --name manual-dogfood
codealmanac doctor --wiki manual-dogfood --json
rm <repo>/.almanac/manual/pages.md
codealmanac doctor --wiki manual-dogfood --json
```

Result: build created `.almanac/manual/README.md` and `ingest.md`; doctor
reported `manual: 8 bundled docs` and `manual: 8 docs`; after deleting
`pages.md`, doctor reported `manual missing: pages.md` with
`run: codealmanac build`.
