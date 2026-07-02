# Slice 45: Cloud Run Retry

## Goal

Add real retry for terminal hosted update runs and expose it through the
CodeAlmanac CLI.

The public command is:

```bash
codealmanac runs retry <run-id>
```

The command is cloud-first, authenticated by the stored CLI token, and does not
depend on the current checkout. The backend authorizes the user through the
original run's repository.

## Product Contract

- Retry creates a new run. It never mutates the original terminal run.
- `failed`, `stale`, and `cancelled` runs may be retried.
- `queued` and `running` runs return conflict because work is already active.
- `delivered` runs return conflict because the wiki update already landed.
- Branch-source retries use the original branch and refresh the current GitHub
  branch head before creating the new run.
- PR-source retries use the original PR number and refresh the current PR head
  through the GitHub App installation token.
- Conversation-batch retries preserve the original `batch_id` and
  `source_refs` by reference, refresh the current branch head, and materialize
  the same source bundle in the worker.
- Delivery mode is selected from current branch trigger policy when present and
  otherwise defaults to `commit`, matching manual branch start.
- Duplicate active/delivered runs for the same refreshed source should return
  the existing run instead of spawning another worker.

## Architecture

```python
new_run = almanac.updates.retry_run(user, run_id)

UpdateRetry.retry(user, run_id)
  original = store.get(...)
  repositories.authorize(user, original.repo_id, APPROVE_UPDATE)
  if original.status in {QUEUED, RUNNING, DELIVERED}: raise Conflict(...)
  repo = repositories.get_repo(...)
  source = refresh_source(original.source, repo)
  run, effects = queue.retry_source(..., source=source, delivery_mode=current_policy(...))
  workers.run(effects)
  return queries.run_for_user(user, run.id)
```

`UpdateRetry` owns the product rules. `RunQueue` owns creation of the new queued
row and `StartWorker` effect. Routes, frontend BFF helpers, and the CLI are
thin wrappers over the same service verb.

## Hosted Files

- `backend/src/almanac/services/updates/retry.py`
- `backend/src/almanac/services/updates/queue.py`
- `backend/src/almanac/services/updates/store.py`
- `backend/src/almanac/services/updates/service.py`
- `backend/src/almanac/server/cli_runs_router.py`
- `backend/src/almanac/server/runs_router.py`
- `frontend/src/lib/api/bff.ts`
- `frontend/src/lib/api/server.ts`
- `frontend/src/lib/api/gateway.ts`

## CodeAlmanac Files

- `src/codealmanac/services/cloud_runs/ports.py`
- `src/codealmanac/services/cloud_runs/requests.py`
- `src/codealmanac/services/cloud_runs/service.py`
- `src/codealmanac/workflows/cloud_runs/requests.py`
- `src/codealmanac/workflows/cloud_runs/service.py`
- `src/codealmanac/integrations/cloud/http.py`
- `src/codealmanac/cli/parser/runs.py`
- `src/codealmanac/cli/dispatch/runs.py`

## Tests

Hosted focused:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_updates_contract.py tests/test_cli_runs_api_contract.py tests/test_repositories_api_contract.py -q
uv run ruff check .
uv run python -m compileall src modal_app -q
```

Frontend focused:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:frontend
npm run lint
```

CodeAlmanac focused:

```bash
cd /Users/rohan/Desktop/Projects/codealmanac
uv run pytest tests/test_cloud_runs_service.py tests/test_cloud_runs_workflow.py tests/test_cli.py tests/test_architecture.py -q
uv run ruff check .
uv run python -m compileall src -q
```

Full gates before commit:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend && uv run pytest -q
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend && npm run test:routes && npm run test:frontend && npm run lint && npm run build
cd /Users/rohan/Desktop/Projects/codealmanac && uv run pytest -q
git diff --check
```
