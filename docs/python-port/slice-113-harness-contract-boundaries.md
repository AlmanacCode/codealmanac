# Slice 113 - Harness Contract Boundaries

Date: 2026-07-01

## Scope

Split the normalized harness contract away from one mixed `models.py` file.

The current rich event model is now a durable CodeAlmanac contract: workflows,
run logs, viewer jobs, Codex app-server, and Claude SDK adapters all depend on
it. One module should not own provider identity, actor attribution, tool
display, usage, failure metadata, event payloads, run results, and terminal
message helpers.

## Non-Goals

- No user-facing CLI changes.
- No provider behavior changes.
- No event schema changes.
- No repo-wide import churn; `services.harnesses.models` remains a small
  import-compatible facade.

## Shape

```python
services.harnesses.kinds      # provider and terminal status enums
services.harnesses.actors     # root/helper attribution models
services.harnesses.events     # normalized transcript event payloads
services.harnesses.results    # readiness, transcript refs, run results
services.harnesses.models     # compatibility facade only
```

## Cosmic Python Transfer

Chapter 4 says the service layer is "the main way into our app"
(`docs/reference/cosmic-python/chapter_04_service_layer.md`). For
CodeAlmanac, the harness service boundary should expose application-owned
contracts. Provider adapters translate Codex and Claude raw payloads into those
contracts, but the contracts themselves should be split by product meaning.

## Files

- `src/codealmanac/services/harnesses/kinds.py`
- `src/codealmanac/services/harnesses/actors.py`
- `src/codealmanac/services/harnesses/events.py`
- `src/codealmanac/services/harnesses/results.py`
- `src/codealmanac/services/harnesses/models.py`
- `tests/test_architecture.py`
- steering docs under `docs/python-port/`

## Verification

Focused:

```bash
uv run pytest tests/test_harnesses_service.py tests/test_ingest_workflow.py::test_ingest_workflow_records_normalized_harness_events tests/test_runs_service.py::test_runs_service_records_job_and_events tests/test_codex_app_server_adapter.py tests/test_claude_adapter.py tests/test_architecture.py::test_harness_contract_models_stay_split_by_meaning -q
uv run ruff check src/codealmanac/services/harnesses tests/test_harnesses_service.py tests/test_ingest_workflow.py tests/test_runs_service.py tests/test_codex_app_server_adapter.py tests/test_claude_adapter.py tests/test_architecture.py
```

Broad:

```bash
uv run pytest
uv run ruff check .
git diff --check
```
