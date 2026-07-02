# Slice 1: Local Control DB Foundation

Date: 2026-07-02.
Status: implemented.

## Goal

Create the home-level local control database foundation required by the launch
architecture.

This slice does not migrate the existing repo-local `almanac/jobs/*.json` run
ledger. It creates the stable SQL seam that later trigger, capture, local job,
worker, and delivery slices will write through.

## Read Before Coding

- `MANUAL.md`
- `docs/codealmanac-launch/schema-contract.md`
- `docs/codealmanac-launch/ownership-map.md`
- `docs/codealmanac-launch/verification-matrix.md`
- `src/codealmanac/database/sqlite.py`
- `src/codealmanac/app.py`
- `tests/test_database.py`
- `tests/test_architecture.py`

## Current Evidence

- `AppConfig` currently exposes `registry_path` and `config_path` only.
- The existing run ledger is file-backed under each wiki root through
  `services/runs`.
- The launch contract requires a separate product/control DB at
  `~/.codealmanac/control.sqlite`.
- The query/index DB already has a SQLite migration pattern under
  `services/index/schema.py`.
- Architecture tests require SQLite imports to remain inside
  `codealmanac.database`.

## Target Shape

```python
app = create_app()

app.control.ensure_ready()
app.control.schema()
app.control.status()
```

```text
src/codealmanac/services/control/
  __init__.py
  models.py      # table/status models
  requests.py    # small service request objects
  schema.py      # control DB migrations and connect_control()
  store.py       # schema/status persistence queries
  service.py     # thin product-facing control DB facade
```

`codealmanac-hosted` can mirror these table names in Supabase migrations. Local
code owns only the one-user subset and must not add account/team/billing tables.

## Tables In Scope

Create these tables exactly as the launch contract names them:

```text
repositories
branches
sessions
turns
turn_branches
trigger_events
runs
run_events
deliveries
```

Include SQL checks for launch vocabulary where it is already settled:

```text
delivery_mode: working_tree | commit | pr
trigger_events.status: pending | claimed | ignored | superseded
runs.status: queued | running | succeeded | failed | stale | cancelled
run_events.kind: status | message | tool | output | error
deliveries.status: pending | succeeded | failed | skipped
```

`pr` is allowed in the table because cloud shares the schema name, but local
policy code will later restrict local delivery to `working_tree | commit`.

## Out Of Scope

- Replacing `services/runs` file-backed storage.
- Git hook installation.
- Trigger event recording.
- Source capture/session ingestion.
- Worker workspace creation.
- Public CLI command changes.
- Cloud Supabase migrations.

## Implementation Plan

1. Add `default_control_db_path()` to `core.paths` and `control_db_path` to
   `AppConfig`.
2. Add `services/control/schema.py` with a single initial migration that creates
   the launch tables and supporting indexes.
3. Add models/store/service for schema/status inspection.
4. Wire `ControlService` into `CodeAlmanac` and `create_app`.
5. Add focused tests proving:
   - the default path is `~/.codealmanac/control.sqlite`;
   - `create_app(...).control.ensure_ready()` creates the DB;
   - all launch tables exist;
   - enum/check constraints reject invalid statuses;
   - query DB and control DB paths are separate.
6. Add an architecture test that the control service has a schema module and
   does not spread SQL into service facade code.
7. Update launch docs/worklog/verification matrix with the slice result.

## Verification

Run:

```bash
uv run pytest tests/test_control_service.py tests/test_database.py tests/test_architecture.py
git diff --check
```

Run broader `uv run pytest` if this touches shared database helpers or
composition root behavior in a way not covered by the focused tests.

## Result

Implemented the control DB seam under `src/codealmanac/services/control/`.
`AppConfig` now defaults `control_db_path` to
`~/.codealmanac/control.sqlite`, and `create_app()` exposes `app.control`.

Focused verification passed:

```text
uv run pytest tests/test_control_service.py tests/test_database.py tests/test_architecture.py
57 passed

git diff --check
passed
```
