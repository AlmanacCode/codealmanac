# Slice 54 - Harness Failure Logs

Date: 2026-06-29

## Scope

Make lifecycle job logs preserve the harness result even when the workflow later
fails.

This slice changes `ingest` and `garden` so they record the returned harness
status and first output line before mutation-safety validation and harness
success validation.

## Non-Goals

- No new public command.
- No streaming harness output.
- No hosted job log or remote upload surface.
- No change to mutation safety precedence. Unsafe app-file mutations still
  fail as safety errors even when the harness status is failed.

## Design

The workflow command still fails loudly:

```python
result = harnesses.run(request)
runs.record_event(harness_output_message(result))
safety = mutation_policy.validate(preflight, workspace, result.changed_files)
validate_harness_result(result)
```

The run log captures the harness return as a past-tense fact before later
validation can replace the terminal error message. That matters when a failed
harness also touched files outside the configured Almanac root: the run error
should remain the safety violation, but `jobs logs` should still show the
harness status and first output line.

## Tests

- ingest failed harness records `output` before `error`
- ingest failed harness plus unsafe app mutation records `output` before the
  safety `error`
- garden failed harness records `output` before `error`

## Verification

Initial focused gate:

```bash
uv run pytest tests/test_ingest_workflow.py tests/test_garden_workflow.py
uv run ruff check src/codealmanac/workflows/lifecycle.py src/codealmanac/workflows/ingest/service.py src/codealmanac/workflows/garden/service.py tests/test_ingest_workflow.py tests/test_garden_workflow.py
```

Result: 17 tests passed; focused ruff passed.

Full gate:

```bash
uv run pytest
uv run ruff check .
git diff --check
uv build --wheel --no-build-logs --out-dir /tmp/codealmanac-build-slice54
```

Result: 235 tests passed; full ruff passed; diff hygiene passed; wheel built
as `codealmanac-0.1.0-py3-none-any.whl`. Wheel inspection confirmed
`codealmanac/workflows/lifecycle.py`,
`codealmanac/workflows/ingest/service.py`, and
`codealmanac/workflows/garden/service.py`.

Live dogfood used an isolated temp registry and temp Git repo. A fake Codex
harness returned `failed` and mutated `src/app.py`; `codealmanac jobs logs`
reported:

```text
6	output	codex failed: dogfood harness failed after mutation
7	error	ingest changed file outside almanac: src/app.py
8	status	failed
```

Result: the terminal run error stayed the safety failure, while the harness
failure remained inspectable in the job log.
