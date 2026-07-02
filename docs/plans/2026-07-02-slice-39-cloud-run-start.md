# Cloud Run Start Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add manual cloud run start from the terminal: `codealmanac runs start --branch <branch>`.

**Architecture:** Hosted owns the product verb `start_branch_run`: authorize the user, read the GitHub branch head, apply the branch delivery policy, create a SQL `runs` row, and spawn the worker. CodeAlmanac resolves the current checkout to a cloud repo and calls the hosted route; the human CLI never starts the model directly.

**Tech Stack:** FastAPI, Pydantic DTOs, SQLModel-backed hosted update service, GitHub App branch refs, Modal worker adapter, CodeAlmanac Python services/workflows, argparse, pytest.

---

## Scope

Implement now:

- Hosted service method for a manual branch run.
- Hosted CLI-token route:
  - `POST /v1/repositories/{repo_id}/runs`
  - body: `{ "branch": "dev" }`
  - response: `RunDTO`
- CodeAlmanac cloud runs service/client method.
- CodeAlmanac workflow that resolves the current checkout's GitHub repo, then starts the requested branch.
- CLI:
  - `codealmanac runs start --branch <branch> [--api-url URL] [--json]`

Defer:

- `codealmanac runs cancel <run-id>`
- `codealmanac runs retry <run-id>`
- GitHub check fanout for queued/running/failed/stale states.
- Browser onboarding UI changes.

Cancellation is deferred because the current Modal adapter only stores a worker call id and does not expose a real cancel operation. Retry is deferred because failed/stale retry semantics need an explicit choice about whether to reuse the old source head or re-resolve the current branch head.

## Product Contract

Manual start is explicit. It does not require a trigger policy to be enabled.

If a trigger policy exists for the branch, its delivery mode is used. If no policy exists, cloud default delivery is `commit`.

The run source is the current GitHub branch head at the time the hosted route executes, not the local checkout SHA. The worker and delivery target therefore share the same cloud-resolved head SHA.

The route requires `Action.APPROVE_UPDATE`, not just `VIEW_REPO`.

## Design Wireframe

```python
# Hosted route edge
body = StartRunRequestDTO(branch="dev")
run = almanac.updates.start_branch_run(user, repo_id, body.branch)
return RunDTO.of(run)

# Hosted service
view = repositories.get_for_action(user, repo_id, Action.APPROVE_UPDATE)
head_sha = github.git.branch_head(view.repo.full_name, branch)
policy = repositories.trigger_policy(session, repo_id, branch)
delivery_mode = policy.delivery_mode if policy else "commit"
outcome, effects = queue.branch_push(..., delivery_mode=delivery_mode)
workers.run(effects)
return run_for_outcome(outcome)

# CodeAlmanac workflow
repo_status = cloud_repo.status(cwd)
run = cloud_runs.start(repo_id=repo_status.repository.repo_id, branch=branch)
render_cloud_run(run)
```

## Task 1: Hosted Manual Branch Run

**Files:**

- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/branches.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/service.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/cli_runs_router.py`
- Create or modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dtos/runs.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_updates_contract.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_cli_runs_api_contract.py`

**Steps:**

1. Add tests for `updates.start_branch_run(user, repo_id, branch)`.
2. Require `Action.APPROVE_UPDATE` through the repository service.
3. Read the branch head through `github.git.branch_head`.
4. Use branch trigger delivery policy when present, otherwise default to `commit`.
5. Create a branch-source run and start the worker.
6. Add `StartRunRequestDTO` and route `POST /v1/repositories/{repo_id}/runs`.
7. Verify focused backend tests.

## Task 2: CodeAlmanac Cloud Runs Start

**Files:**

- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/services/cloud_runs/ports.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/services/cloud_runs/requests.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/services/cloud_runs/service.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/integrations/cloud/http.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/workflows/cloud_runs/models.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/workflows/cloud_runs/requests.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/workflows/cloud_runs/service.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/cli/parser/runs.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/cli/dispatch/runs.py`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/src/codealmanac/cli/render/cloud_runs.py`
- Test: `/Users/rohan/Desktop/Projects/codealmanac/tests/test_cloud_runs_service.py`
- Test: `/Users/rohan/Desktop/Projects/codealmanac/tests/test_cloud_runs_workflow.py`
- Test: `/Users/rohan/Desktop/Projects/codealmanac/tests/test_cli.py`

**Steps:**

1. Add a typed request for starting a cloud run.
2. Add `CloudRunsClient.start_repository_run(...)`.
3. Add HTTP `POST /v1/repositories/{repo_id}/runs` with body `{"branch": branch}`.
4. Add workflow method `CloudRunsWorkflow.start(...)`.
5. Add parser and dispatch for `runs start --branch <branch>`.
6. Render the returned `RunDTO` through the existing cloud-run renderer.
7. Verify focused CodeAlmanac tests.

## Task 3: Docs, Verification, Commit, Push

**Files:**

- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/auth-api-contract.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/cli-contract.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/progress.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/verification-matrix.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/worklog.md`
- Modify: `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/next-agent-brief.md`

**Verification:**

Hosted:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_updates_contract.py tests/test_cli_runs_api_contract.py -q
uv run ruff check .
uv run python -m compileall src modal_app -q
uv run pytest -q
```

CodeAlmanac:

```bash
cd /Users/rohan/Desktop/Projects/codealmanac
uv run pytest tests/test_cloud_runs_service.py tests/test_cloud_runs_workflow.py tests/test_cli.py tests/test_architecture.py -q
uv run ruff check .
uv run python -m compileall src -q
uv run pytest -q
git diff --check
```

Commit/push:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
git add backend
git commit -m "feat: start cloud runs from CLI"
git push origin codex/workos-authkit-api-foundation

cd /Users/rohan/Desktop/Projects/codealmanac
git add src tests docs
git commit -m "feat: start cloud runs from CLI"
git push origin dev
```
