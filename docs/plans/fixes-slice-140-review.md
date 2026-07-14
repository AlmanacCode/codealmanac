# Fixes: Slice 140 Yoke usage projection review

## Scope

- Preserve Yoke's `cache_creation_input_tokens` in CodeAlmanac's durable
  `HarnessUsage` projection.
- Validate the field as a non-negative token count alongside the existing usage
  fields.
- Prove the Claude-shaped Yoke usage event survives projection and SQLite
  run-event persistence unchanged.

## Out of scope

- Recomputing provider totals or aggregating cumulative usage snapshots.
- Changing lifecycle execution, run-event storage, or user-facing rendering.
- Reimplementing Yoke's Claude or Codex usage semantics in CodeAlmanac.

## Design

`HarnessUsage` remains the service-owned persistence contract. The Yoke adapter
projects the additional normalized field directly; `RunEventStore` continues to
serialize the complete nested model without field-specific storage logic.

This follows the existing boundary: “Raw external shapes don't leak past the
normalization boundary” (`MANUAL.md`) and keeps persistence behind the existing
repository abstraction rather than adding provider-aware database behavior
(`docs/reference/cosmic-python/chapter_02_repository.md`).

## Files

- `src/codealmanac/services/harnesses/events.py`
- `src/codealmanac/integrations/harnesses/yoke/events.py`
- `tests/test_yoke_harness_integration.py`
- `tests/test_runs_service.py`
- `almanac/reference/harness-event-shape.md`
- `pyproject.toml` and `uv.lock` pin the corrected Yoke source revision for
  development while leaving published package metadata on the compatible
  `>=0.1.7,<0.2` requirement.

## Release note

The next CodeAlmanac release must either retain the exact uv source override or
depend on a published Yoke release containing revision
`7ed04b57cbd17543f2f0576e850368f0d5fdf2a1`. Removing the override while PyPI
still resolves the older 0.1.7 artifact would make the typed projection
unexecutable.

## Verification

- Focused projection, validation, and run-event round-trip tests.
- Full `uv run pytest`.
- Full `uv run ruff check .`.
- Full `uv run pyright` if configured by this repository.

## Read before coding

- `MANUAL.md`
- `docs/python-port-live-agreement.md`
- `docs/plans/slice-140-yoke-runtime-integration.md`
- `almanac/architecture/agent-runs/harness-contract.md`
- `almanac/architecture/agent-runs/provider-adapters.md`
- `docs/reference/cosmic-python/chapter_02_repository.md`
