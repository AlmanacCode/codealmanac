# Slice 120: Run Store Factory And Query Boundaries

## Scope

Keep run ledger behavior unchanged while keeping `RunStore` as the
service-facing repository facade and moving record factory/query mechanics into
focused modules.

## Out of scope

- No run status transition change.
- No job event schema change.
- No queue policy change.
- No worker lock change.
- No CLI command change.

## Design

Cosmic Python chapter 6 describes the unit-of-work/repository neighborhood as
the boundary around persistent state. In CodeAlmanac, `RunStore` is the
repository facade for durable run state. It should expose run verbs and
coordinate existing persistence helpers, but run-id generation, log-path
construction, record sorting, and spec-backed queue selection are mechanics
with their own reasons to change.

Target shape:

```python
record = new_run_record(almanac_root, workspace_id, operation, title, now)
records = list_run_records(ledger, almanac_path, limit)
queued = next_spec_backed_queued_run(ledger, almanac_path)
```

`factory.py` owns run-id and initial `RunRecord` construction.
`queries.py` owns sorted record listing and oldest spec-backed queued-run
selection. `store.py` remains the public repository facade over
`io.py`, `transitions.py`, `locks.py`, `factory.py`, and `queries.py`.

## Verification

- Focused run service and queue workflow tests.
- Architecture guard keeping factory/query mechanics out of `RunStore`.
- Isolated CLI dogfood for queued/background jobs plus attach/log visibility.
