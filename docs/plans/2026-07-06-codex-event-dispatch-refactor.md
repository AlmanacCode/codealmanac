# Codex Event Dispatch Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep Codex app-server event normalization split by provider-edge responsibility by making `events.py` a smaller notification dispatcher.

**Architecture:** Keep `src/codealmanac/integrations/harnesses/codex/events.py` as the dispatcher named in the live agreement. Move notification-specific handler logic for text/plan deltas, plan updates, output deltas, warnings, and errors into `notification_events.py`. Do not move item, agent, usage, turn-completion, or result mapping back into `events.py`.

**Tech Stack:** Existing Codex app-server harness event model, focused Codex adapter tests, pytest, ruff.

---

## Scope

In scope:

- Keep `map_codex_notification(...)` public behavior unchanged.
- Extract private helper functions inside `events.py`.
- Add `notification_events.py` when the architecture cap proves the helpers do
  not belong in the dispatcher file.
- Keep `item_events.py`, `agent_events.py`, and `result.py` as the owners of their existing responsibilities.
- Update the refactor worklog.

Out of scope:

- No new provider event behavior.
- No changes to raw Codex JSON handling.
- No new files except `notification_events.py` if the dispatcher cap requires it.

## Tasks

### Task 1: Extract Inline Event Handlers

**Files:**

- Modify: `src/codealmanac/integrations/harnesses/codex/events.py`

Steps:

1. Add an `OUTPUT_DELTA_METHODS` constant.
2. Create `src/codealmanac/integrations/harnesses/codex/notification_events.py`.
3. Move text delta, plan delta, plan update, output delta, warning, error, and
   plan-summary helpers into `notification_events.py`.
4. Update `events.py` to stay a dispatcher over notification methods.
5. Update the architecture test to include `notification_events.py` and forbid
   error/event-kind details in `events.py`.
6. Keep event kinds, messages, actor assignment, raw payloads, and state mutation identical.

### Task 2: Verify And Record

**Files:**

- Modify: `docs/refactor-audit-2026-07-06/worklog.md`

Run:

```bash
uv run pytest tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py -q
uv run ruff check src/codealmanac/integrations/harnesses/codex/events.py tests/test_codex_app_server_adapter.py tests/test_codex_adapter.py
uv run pytest
uv run ruff check .
git diff --check
```

Expected: all pass.

Commit:

```bash
git add src/codealmanac/integrations/harnesses/codex/events.py src/codealmanac/integrations/harnesses/codex/notification_events.py tests/test_architecture.py docs/plans/2026-07-06-codex-event-dispatch-refactor.md docs/refactor-audit-2026-07-06/worklog.md
git commit -m "refactor: slim codex event dispatcher"
```
