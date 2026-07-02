# Slice 6: Trigger Claim To Run Handoff

Date: 2026-07-02.
Status: implemented.

## Goal

Claim pending trigger events and create queued control run rows in one control
DB transaction.

This slice creates the local/cloud-parallel handoff from finalization events to
run execution. It does not execute workers yet.

## Target Shape

```python
claim = app.control.claim_next_trigger(ClaimNextTriggerRequest())
if claim.claimed:
    run = claim.run
```

## Behavior

- Select the oldest pending trigger event, optionally scoped by repository or
  branch.
- Mark the trigger event `claimed` and set `claimed_at`.
- Create a queued run row with:
  - `trigger_event_id`
  - `repository_id`
  - `branch_id`
  - `expected_head_sha = trigger.head_sha`
  - optional `source_bundle_ref` and `request_ref`
- Return `claimed=False` when no pending trigger exists.

## Out Of Scope

- Worker execution.
- Source bundle construction.
- Active-run cancellation when branch head changes.
- Delivery rows.
- Cross-process lock stress tests.

## Verification

Run:

```bash
uv run pytest tests/test_control_service.py tests/test_architecture.py
uv run ruff check .
git diff --check
```

Run full `uv run pytest` before committing.

## Result

Implemented `app.control.claim_next_trigger(...)`.

The method selects a pending trigger, marks it `claimed`, sets `claimed_at`, and
creates a queued control run whose `expected_head_sha` is copied from the
trigger's `head_sha`. It returns `claimed=False` with reason
`no_pending_trigger` when nothing is available.

Focused verification passed:

```text
uv run pytest tests/test_control_service.py tests/test_architecture.py
66 passed

uv run ruff check .
passed

git diff --check
passed
```
