# GitHub Check Fanout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish GitHub Check Runs for terminal hosted update outcomes.

**Architecture:** Keep update services provider-neutral. `services/events` emits terminal run facts; `wiring/fanout/github_checks.py` subscribes to those events; `integrations/github` owns the concrete Check Runs API call. This mirrors billing fanout: domain events are product facts, fanout modules decide which external systems hear about them, integrations perform transport.

**Tech Stack:** Hosted Python backend, Pydantic models, GitHub App installation tokens, GitHub Check Runs REST API, event fanout, pytest, Ruff.

---

## Scope

Implement now:

- Add a typed GitHub Check Run model and GitHub Checks capability.
- Add a `GitHubChecksFanout` subscriber for:
  - `RunDelivered`
  - `RunFailed`
  - `RunStale`
- Publish completed Check Runs to the run source head SHA.
- Use a stable check name such as `CodeAlmanac Wiki Update`.
- Use `success` for delivered runs that changed files.
- Use `neutral` for delivered runs with no wiki changes.
- Use `failure` for failed runs.
- Use `action_required` for stale runs because GitHub docs say clients cannot
  set `stale`; GitHub alone can set that conclusion.
- Include `details_url` back to the hosted run page when a frontend base URL is
  available.

Defer:

- Requested action buttons.
- Handling `check_run.rerequested` or `check_run.requested_action`.
- `codealmanac runs retry`.
- `codealmanac runs cancel`.
- Persisting GitHub Check Run ids on `runs`; create terminal checks first, store
  ids only when a later feature needs update/rerequest semantics.

## External Contract Notes

GitHub's REST Check Runs API says:

- Check write is GitHub App-only.
- Creating a check run is `POST /repos/{owner}/{repo}/check-runs`.
- Completed check runs need a conclusion.
- Clients cannot change a check run conclusion to `stale`; only GitHub can set
  `stale`.
- Actions are limited to three buttons, with 20-character identifiers and
  labels. This slice intentionally avoids actions until retry/cancel semantics
  are explicit.

## Design Wireframe

```python
event = RunFailed(...)

fanout.on_run_failed(event, session)
  check = GitHubCheckRun.completed(
      name="CodeAlmanac Wiki Update",
      head_sha=event.head_sha,
      conclusion="failure",
      details_url=run_url(event.run_id),
      output=GitHubCheckOutput(...),
  )
  github.checks.create(event.repo_full_name, check)
```

`GitHubChecksFanout` knows how to translate domain events to check summaries.
It does not call stores, mutate runs, or decide run state.

## Task 1: GitHub Check Models And Resource

**Files:**

- Create: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/integrations/github/models/checks.py`
- Create: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/integrations/github/resources/checks.py`
- Create: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/integrations/github/capabilities/checks.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/integrations/github/client.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/integrations/github/__init__.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_github_checks_contract.py`

**Steps:**

1. Add frozen Pydantic models for check output and check run creation.
2. Keep literals constrained to the GitHub conclusions this product emits.
3. Resource calls `POST /repos/{repo_full_name}/check-runs` with the typed body.
4. Capability resolves an installation token through `App` and wraps calls with
   `github_call`.
5. Tests prove body shape, endpoint path, app-token use, and response id parsing.

## Task 2: Event Fanout

**Files:**

- Create: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/wiring/fanout/github_checks.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/wiring/fanout/__init__.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/app.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_github_checks_fanout.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_architecture_contract.py`

**Steps:**

1. Add `GitHubChecksFanout` with `subscribe_events`.
2. Subscribe to delivered, failed, and stale run events.
3. Render user-readable output summaries with run id and reason/changed files.
4. Build hosted run detail URLs from `frontend_base_url`.
5. Wire the fanout in the composition root by passing `github_adapter` and
   `frontend_base_url` into `Fanout`.
6. Add architecture tests proving update services do not import GitHub Checks
   and the subscriber lives in `wiring/fanout`.

## Task 3: Verification And Docs

**Files:**

- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/verification-matrix.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/worklog.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/next-agent-brief.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/progress.md`

**Verification:**

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_github_checks_contract.py tests/test_github_checks_fanout.py tests/test_events_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q
uv run pytest -q
uv run ruff check .
uv run python -m compileall src modal_app -q
git diff --check
```
