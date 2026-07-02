# Slice 7 Plan: Engine Run Artifacts

Date: 2026-07-02.
Status: planned.

## Goal

Add the shared engine request/result artifact contract used by both local
CodeAlmanac workers and hosted CodeAlmanac workers.

This slice creates the seam only. It does not rewrite the existing
repo-local lifecycle jobs or expose a public CLI command.

## Contract

Local artifacts live under:

```text
~/.codealmanac/runs/<run-id>/
  request.json
  result.json
  artifacts/
```

The request passes source material by reference:

```python
app.engine_runs.prepare(...)
```

The request records repo identity, branch identity, expected head SHA,
`repo_path`, `sources_path`, `run_path`, and `almanac_root`.

The result records terminal status, summary, commit subject/body, changed files,
and optional error. It does not decide delivery.

## Shape

```text
src/codealmanac/services/engine_runs/
  models.py      # EngineRunRequest, EngineRunResult, paths, changed files
  requests.py    # Prepare/write/read commands
  store.py       # JSON persistence under configured artifact root
  service.py     # product verbs
  __init__.py
```

`AppConfig` gets `run_artifacts_path`, defaulting to
`~/.codealmanac/runs`.

`create_app()` wires:

```python
engine_runs = EngineRunsService(
    EngineRunsStore(app_config.run_artifacts_path)
)
```

## Decisions

- Use `engine_runs`, not `runs`, because `services/runs` is the current
  repo-local job ledger. The new service owns the shared worker contract.
- Keep request/result storage file-backed locally. Cloud can map the same
  models to object storage refs later.
- Do not inline sessions, conversations, commits, source bundle contents, or
  prompt material in `request.json`. The model receives paths/refs.
- Keep commit message output in the result with subject/body fields. The worker
  should be prompted to use the `docs almanac:` subject style.
- Keep delivery outside this service. Delivery validates and commits/applies the
  result later.

## Tests

- Default artifact root is `~/.codealmanac/runs`.
- Preparing a run creates the run directory, `request.json`, and `artifacts/`.
- `request.json` round-trips through typed models.
- `result.json` round-trips through typed models.
- Request JSON stores `sources_path` and `source_bundle_ref`, not source
  contents.
- Architecture test keeps the service/store split and prevents control/CLI
  leakage into the service.

## Docs

- Update launch worklog.
- Update verification matrix.
- Update next-agent brief.
- Add progress tracking for RelayForge slice updates.
