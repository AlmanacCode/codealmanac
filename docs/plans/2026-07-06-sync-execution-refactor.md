# Sync Execution Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make sync run execution easier to extend by removing duplicated pending-ledger writes from the foreground and background item paths.

**Architecture:** Keep `workflows/sync/execution.py` as the owner of sync execution effects. Extract small private methods on `SyncRunExecutor` for ledger writes so `run_background_item()` and `run_foreground_item()` read as orchestration: build request, start/queue run, claim pending, execute, record result.

**Tech Stack:** Existing Pydantic sync models, `SyncLedgerStore`, pytest sync workflow tests, ruff.

---

## Read Before Coding

- `MANUAL.md`
- `almanac/architecture/sync-and-automation.md`
- `almanac/style/refactoring.md`
- `docs/python-port-live-agreement.md`
- `docs/reference/cosmic-python/chapter_04_service_layer.md`

Useful local line from Cosmic Python:

> "It often makes sense to split out a service layer, sometimes called an orchestration layer or a use-case layer."

## Scope

In scope:

- Keep public sync behavior unchanged.
- Keep `SyncRunExecutor` in `workflows/sync/execution.py`.
- Extract private methods for repeated ledger save/update mechanics.
- Update the refactor worklog.

Out of scope:

- No new sync modules.
- No changes to sync policy or candidate evaluation.
- No changes to foreground/background product behavior.

## Tasks

### Task 1: Extract Pending Claim And Ledger Save Helpers

**Files:**

- Modify: `src/codealmanac/workflows/sync/execution.py`

Steps:

1. Add `_save_entry(...)` on `SyncRunExecutor`.
2. Add `_claim_pending(...)` returning updated ledgers and the work item with
   its pending entry.
3. Use `_claim_pending(...)` in both `run_background_item(...)` and `run_foreground_item(...)`.
4. Keep `pending_entry(...)` arguments identical.

### Task 2: Extract Failure Ledger Write Helper

**Files:**

- Modify: `src/codealmanac/workflows/sync/execution.py`

Steps:

1. Add `_record_failure(...)` on `SyncRunExecutor`.
2. Use it in worker-spawn failure and foreground ingest failure paths.
3. Keep failure reasons unchanged: `worker-spawn-failed` and `ingest-failed`.

### Task 3: Verify And Record

**Files:**

- Modify: `docs/refactor-audit-2026-07-06/worklog.md`

Steps:

1. Run:

```bash
uv run pytest tests/test_sync_workflow.py -q
uv run ruff check src/codealmanac/workflows/sync/execution.py tests/test_sync_workflow.py
```

Expected: all pass.

2. Add a short worklog section with the smell and verification.
3. Run full gates:

```bash
uv run pytest
uv run ruff check .
git diff --check
```

Expected: all pass.

4. Commit:

```bash
git add src/codealmanac/workflows/sync/execution.py docs/plans/2026-07-06-sync-execution-refactor.md docs/refactor-audit-2026-07-06/worklog.md
git commit -m "refactor: simplify sync ledger execution"
```
