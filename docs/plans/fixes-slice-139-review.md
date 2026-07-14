# Fixes — Slice 139 Review

**Date:** 2026-07-10

## Must-fix

### 1. Preserve cancellation facts across every live run write

`record_event`, transcript attachment, and ordinary finish currently read a
record and later upsert the whole JSON document through separate connections.
They can overwrite a concurrently committed `cancellation_requested_at` or
collide on event sequence allocation.

Make every live run mutation read the latest row, update only from that latest
model, write the record, and append its event inside one `BEGIN IMMEDIATE`
transaction. Add a regression test proving event and transcript writes after a
cancellation request preserve execution identity and cancellation intent.

### 2. Do not confirm an empty executor-tree snapshot

The executor can exit after PID/birth-time validation but before the process
tree is frozen. The current freezer treats that initial `NoSuchProcess` like a
vanished descendant and returns an empty list, which lets cancellation claim
success without confirming reparented children.

Treat disappearance of the root before it is captured as unconfirmed
termination. Keep benign handling only for descendants that disappear after
the verified root has been frozen. Add a deterministic unit test for the empty
root snapshot.

## Verification

```bash
uv run pytest tests/test_runs_service.py tests/test_run_process.py \
  tests/test_run_queue_workflow.py
uv run pytest
uv run ruff check .
codealmanac validate
git diff --check
```
