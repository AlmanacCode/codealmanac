# Slice 134: Lifecycle Helper Boundaries

## Scope

Keep page-writing lifecycle behavior unchanged while splitting the shared
`workflows/lifecycle.py` helper module by responsibility.

## Out of scope

- No Ingest or Garden behavior changes.
- No run ledger or harness event schema changes.
- No CLI command changes.
- No new lifecycle operation type.

## Design

Cosmic Python chapter 4 describes orchestration as the service-layer work that
fetches current state, checks invariants, calls lower-level behavior, and saves
changes (`docs/reference/cosmic-python/chapter_04_service_layer.md`). The
current `workflows/lifecycle.py` module mixes two different lower-level
concerns used by `PageRunWorkflow`: workspace mutation safety and harness result
event classification.

The split is:

```python
workflows.lifecycle            # import-compatible facade
  -> lifecycle_mutation.py      # git/workspace mutation preflight and validation
  -> lifecycle_harness.py       # harness result validation and event mapping
```

`PageRunWorkflow` can keep importing from `workflows.lifecycle`, but the facade
must not own path-diff mechanics or harness event classification.

## Verification

- Existing Ingest workflow tests.
- Existing Garden workflow tests.
- Existing architecture tests for page-run ownership.
- New architecture guard that keeps `workflows/lifecycle.py` as a small facade.
- Public CLI dogfood for read-only `codealmanac jobs` or lifecycle-adjacent
  status output if available without starting a model run.
- Full pytest, Ruff, and diff checks.
