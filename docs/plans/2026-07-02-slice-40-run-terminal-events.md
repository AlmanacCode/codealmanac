# Run Terminal Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Emit first-class domain events when hosted runs fail or go stale.

**Architecture:** Keep terminal run state in `UpdateCompletion`. The completion service already writes `runs` and `run_events`; it should also dispatch typed `RunFailed` and `RunStale` domain events next to the existing `RunDelivered` event. Provider-specific reactions such as GitHub Checks subscribe later through `wiring/fanout`.

**Tech Stack:** Hosted FastAPI backend service layer, Pydantic domain events, SQLModel transaction-bound event dispatcher, pytest.

---

## Scope

Implement now:

- `RunFailed` domain event.
- `RunStale` domain event.
- Dispatch `RunFailed` when a worker completes with `error` or `blocked`.
- Dispatch `RunStale` when delivery sees the expected branch head changed.
- Tests proving events are dispatched after the run row and run event are
  written.

Defer:

- GitHub Check Run publisher.
- GitHub check-run retry action handling.
- `codealmanac runs retry` and `codealmanac runs cancel`.

## Design Wireframe

```python
failed = store.mark_failed(...)
events.dispatch([RunFailed(...)], session=session)
return UpdateResult.failed(failed, bundle)

stale = store.mark_stale(...)
events.dispatch([RunStale(...)], session=session)
return UpdateResult.stale(stale, exc.reason)
```

`RunFailed` and `RunStale` carry repo/account/run/source facts. They do not know
about GitHub checks, billing, Slack, dashboards, or CLI rendering.

## Task 1: Domain Events

**Files:**

- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/events/models.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/events/__init__.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_events_contract.py`

**Steps:**

1. Add `RunFailed` with run id, repo id, account id, repo full name, head sha,
   and reason.
2. Add `RunStale` with the same run facts plus expected and actual head shas.
3. Add both to the `DomainEvent` type alias and export surface.

## Task 2: Completion Dispatch

**Files:**

- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/completion.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_updates_contract.py`

**Steps:**

1. Dispatch `RunFailed` after `mark_failed`.
2. Dispatch `RunStale` after `mark_stale`.
3. Preserve conversation-batch success/failure/stale updates.
4. Keep `RunDelivered` unchanged.

## Task 3: Verification And Docs

**Files:**

- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/verification-matrix.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/worklog.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/next-agent-brief.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/progress.md`

**Verification:**

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_events_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q
uv run pytest -q
uv run ruff check .
uv run python -m compileall src modal_app -q
git diff --check
```
