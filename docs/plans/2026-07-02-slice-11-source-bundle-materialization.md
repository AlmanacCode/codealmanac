# Slice 11: Source Bundle Materialization

Date: 2026-07-02.
Status: planned.

## Goal

Materialize the local worker `sources/` folder during local run preparation.
The run request should continue to pass a `sources_path` and
`source_bundle_ref`; it should not inline session contents or selected source
payloads.

## Shape

```python
sessions = control.list_sessions_for_branch(branch.id)
bundle = source_bundles.materialize(
    run_id=run.id,
    branch_id=branch.id,
    target_path=worker_workspace.paths.sources_path,
    sessions=sessions,
)
engine = engine_runs.prepare(..., sources_path=bundle.root_path)
```

The control DB owns session/turn/branch relationships. The source-bundle service
owns file materialization and the manifest format. The local-run workflow only
orchestrates services.

## In Scope

- Add control service verbs for:
  - upserting sessions
  - upserting turns
  - linking turns to branches
  - listing distinct sessions connected to a branch
- Add `services/source_bundles` with:
  - typed manifest models
  - a materialization request
  - a store that copies referenced local session files into `sources/`
  - `manifest.json`
- Wire local run preparation to materialize the source bundle before writing
  `request.json`.
- Add tests for control session selection, source bundle materialization, and
  local run preparation.
- Update launch docs and progress.

## Out Of Scope

- Conversation capture hooks.
- Branch detection algorithms.
- Git commit range evidence.
- Model execution.
- Delivery application.

## Design Decisions

- The selector is intentionally simple: include every full session with at least
  one turn linked to the branch.
- The bundle copies source files into the worker workspace, but the run request
  still passes the bundle by reference via `sources_path` and
  `source_bundle_ref`.
- Session destination filenames use the stable local session row id, not raw
  provider paths.
- Missing or unsupported session refs fail preparation. That is better than
  silently running with incomplete source context.

## Verification

Focused:

```text
uv run pytest tests/test_control_service.py tests/test_source_bundles_service.py tests/test_local_run_preparation_workflow.py tests/test_architecture.py
```

Full:

```text
uv run pytest
uv run ruff check .
git diff --check
```
