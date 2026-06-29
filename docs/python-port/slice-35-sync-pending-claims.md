# Slice 35 - Sync Pending Claims

Date: 2026-06-29

## Scope

Foreground `codealmanac sync` must claim a transcript range before invoking
Ingest. The claim is stored in `.almanac/jobs/sync-ledger.json` as a
`PENDING` entry with owner, start time, and line range.

## Non-goals

- No background worker.
- No automatic retry of stale pending work.
- No new public CLI flag.
- No hosted sync semantics.

## Design

`SyncWorkflow.run()` evaluates ready transcript ranges, writes a pending entry,
saves the ledger, then calls Ingest. On success it advances the cursor and
clears the pending fields. On failure it records the error and clears the
pending fields.

`SyncWorkflow.status()` and `SyncWorkflow.run()` use the same cursor evaluation:
active pending entries are skipped, and stale pending entries are returned as
needs-attention.

Ledger session keys use normalized transcript paths. Lookup also accepts an
entry whose stored app, session id, and normalized transcript path match the
candidate, which covers raw path strings produced before this slice or through
macOS `/var` and `/private/var` aliases.

This follows the Cosmic Python chapter 6 Unit of Work pressure: the workflow
creates a durable persistence checkpoint before the side-effecting operation so
the next process does not have to infer whether a range was claimed.

## Verification

- `uv run pytest tests/test_sync_workflow.py`
- `uv run pytest tests/test_sync_workflow.py tests/test_cli.py::test_cli_sync_status_reports_ready_transcripts tests/test_architecture.py` - 13 passed
- `uv run ruff check src/codealmanac/workflows/sync tests/test_sync_workflow.py`
- Service/CLI dogfood proved pending is visible before harness write, terminal
  success clears pending fields, active pending status skips, and stale pending
  status reports needs-attention.
- `uv run pytest` - 174 passed
- `uv run ruff check .` - passed
- `git diff --check` - passed
