# Restore Repository Manuals

## Scope

Restore repository-local writing manuals during `codealmanac init` before the
build run starts, and make the build-agent instructions reference their exact
paths under `almanac/manual/`.

## Out Of Scope

- No new manual storage abstraction or synchronization command.
- No overwrite of repository-local manual edits.
- No change to the nested wiki page layout.
- No change to manual package resources or their prose.

## Design

`WikiService.initialize(...)` remains the deterministic repository-scaffolding
verb. It delegates manual copying to the existing `ManualLibrary.install_missing`
boundary, targeting `<repo>/almanac/manual/`, before any build run can reach the
harness.

The build agent and its writing sub-agents use exact repository-relative manual
paths. Manuals are passed by filesystem reference rather than requiring the main
agent to reproduce their full text in every child prompt.

Existing files remain untouched because `ManualLibrary.install_missing(...)`
copies only missing documents. `services/wiki/paths.py` already reserves the
`manual` directory, so these Markdown resources remain outside the indexed wiki
page set.

This follows the service-layer guidance that a service layer “capture[s] the use
case” and becomes the entrypoint for the workflow
(`docs/reference/cosmic-python/chapter_04_service_layer.md`). Initialization,
not the CLI or harness adapter, therefore owns making required repository
resources available.

## File Changes

- `src/codealmanac/services/wiki/service.py`: install missing manuals during
  repository initialization.
- `src/codealmanac/agents/build/instructions.md`: replace manual-body propagation
  instructions with exact `almanac/manual/*.md` references.
- `src/codealmanac/workflows/build/`: pass the repository manual root instead of
  embedding bundled manual bodies in build runtime context.
- `src/codealmanac/app.py`: stop injecting `ManualLibrary` into `BuildWorkflow`;
  repository scaffolding continues to receive it through `WikiService`.
- `tests/test_build_workflow.py`: prove initialization creates manuals and prove
  they exist before harness execution.
- `tests/test_wiki_parsing.py`: retain explicit coverage that reserved manuals
  are excluded from page iteration if existing coverage is insufficient.

## Test Coverage

- Initialization creates the complete `almanac/manual/` library.
- Existing manual files are preserved by the underlying library contract.
- The build harness observes required manual files before it writes pages.
- Manual Markdown files do not increase indexed page counts.
- Focused pytest and Ruff gates, followed by the full project gates.

## Read Before Coding

- `MANUAL.md`
- `docs/python-port-live-agreement.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`
- `docs/reference/cosmic-python/chapter_13_dependency_injection.md`
- `almanac/reference/page-format/links-and-routes.md`
- `src/codealmanac/services/wiki/paths.py`
