# Hosted Trigger Policies Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add cloud maintained-branch trigger policies and use them to start hosted update runs from GitHub branch push events.

**Architecture:** Trigger policy is repository-owned product state, separate from `repository_settings.same_repo`. GitHub already normalizes push webhooks into `BranchPushed`; `services/updates` should decide whether that message starts a run based on the configured trigger policy. The frontend mirrors this state in repository settings and lets users enable/disable branches and choose commit vs PR delivery from real GitHub branch data.

**Tech Stack:** Python FastAPI backend, SQLModel tables/store/service, Supabase SQL migrations, Pydantic DTOs, Next.js/TypeScript frontend, pytest, node:test.

---

## Read Before Coding

- `/Users/rohan/.codex/skills/slow-development/SKILL.md`
- `/Users/rohan/.codex/skills/python-code-quality/SKILL.md`
- `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/AGENTS.md`
- `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/MANUAL.md`
- `docs/codealmanac-launch/cli-contract.md`
- `docs/codealmanac-launch/frontend-surface-contract.md`
- `docs/codealmanac-launch/schema-contract.md`

## Design Decisions

- Name the persisted branch policy `RepositoryTriggerPolicy`.
- Store policies in `repository_trigger_policies`, keyed by `(repo_id, branch)`.
- Branch names are data, not path structure. Writes use a body field for `branch` so `release/1.4` works without URL ambiguity.
- Cloud delivery modes are `commit` and `pr`.
- Default branch-push delivery is `commit`.
- Keep same-repo PR automation intact; it remains an existing PR-trigger setting until a later cleanup.
- Ignore push events for branch creation/deletion and bot commits in this slice.
- Do not add CLI commands in this slice. The browser configuration surface comes first; CLI mirror commands can call the same API later.

## Wireframe

```python
# repo settings surface
policy = repositories.upsert_trigger_policy_for_account(
    user, account_id, repo_id,
    TriggerPolicyPatch(branch="main", enabled=True, delivery_mode="commit"),
)

# GitHub push fanout
effects = updates.start_branch_push_from_github(session, message)

# update decision
policy = repositories.trigger_policy(session, repo_id, branch)
if policy is None or not policy.enabled:
    return []
delivery = CommitToBranch(...) if policy.delivery_mode == "commit" else OpenWikiPullRequest(...)
return queue.branch_push(..., delivery_mode=policy.delivery_mode)
```

## Task 1: Backend Trigger Policy Storage

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/repositories/models.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/repositories/tables.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/repositories/records.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/repositories/store.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/repositories/service.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/supabase/migrations/20260620000000_init.sql`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_repositories_contract.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_architecture_contract.py`

**Steps:**
1. Add `DeliveryMode = Literal["commit", "pr"]`.
2. Add `RepositoryTriggerPolicy(repo_id, branch, enabled, delivery_mode)`.
3. Add `TriggerPolicyPatch(branch, enabled, delivery_mode)`.
4. Add `RepositoryTriggerPolicyRow`.
5. Add store methods to list, get, and upsert trigger policies.
6. Add account-scoped service methods that require `EDIT_SETTINGS`.
7. Add non-user service read method for update fanout inside an existing session.
8. Add SQL migration DDL and indexes.
9. Prove update requires edit permission and stores slash-containing branch names.

## Task 2: Branch Push Update Runs

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/queue.py`
- Create: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/branches.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/services/updates/service.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/wiring/fanout/updates.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_updates_contract.py`

**Steps:**
1. Add `RunQueue.branch_push(...)` with delivery selected by trigger policy.
2. Add `BranchPushUpdates.plan(session, message)`.
3. Ignore branch deletion/creation, missing policy, disabled policy, duplicate head, and capacity exhaustion.
4. Wire `BranchPushed` into `UpdatesFanout`.
5. Prove enabled commit policy creates a `BranchSource` and `CommitToBranch`.
6. Prove enabled PR policy creates an `OpenWikiPullRequest`.
7. Prove disabled or missing policy creates no worker effect.

## Task 3: API DTOs and Routes

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dtos/repositories.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dtos/__init__.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/dto.py`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/src/almanac/server/repositories_router.py`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend/tests/test_repositories_api_contract.py`

**Steps:**
1. Add `RepositoryTriggerPolicyDTO`.
2. Add `RepositoryTriggerPolicyPatchDTO`.
3. Add `GET /api/accounts/{account_id}/repositories/{repo_id}/triggers`.
4. Add `PUT /api/accounts/{account_id}/repositories/{repo_id}/triggers`.
5. Prove routes are account scoped and support branch names with `/`.

## Task 4: Frontend Settings UI

**Files:**
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/dto/repositories.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/bff.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/server.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/lib/api/gateway.ts`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/components/repositories/settings-form.tsx`
- Modify: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/src/app/dashboard/accounts/[accountId]/repositories/[repoId]/settings/page.tsx`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/tests/frontend/gateway.test.ts`
- Test: `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend/tests/frontend/repository-settings.test.tsx`

**Steps:**
1. Add frontend trigger policy DTOs.
2. Add `listRepositoryTriggers(...)` and `saveRepositoryTrigger(...)`.
3. Add `PUT` allowlist for account-scoped trigger policy writes.
4. Server-render branch list and saved trigger policies in the settings page.
5. Let editable users toggle a branch and choose `commit` or `pr`.
6. Keep non-editable users read-only.
7. Prove branch rows render saved trigger state and delivery mode.

## Task 5: Verification and Commit

**Commands:**
- Backend focused:
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend && uv run pytest tests/test_repositories_contract.py tests/test_repositories_api_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q`
- Frontend focused:
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend && npm run test:frontend && npm run test:routes`
- Hosted hygiene/full:
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend && uv run ruff check . && uv run ruff format --check . && python -m compileall src modal_app -q && uv run pytest -q`
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend && npm run lint`
  - `cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence && git diff --check`

**Docs:**
- Update local launch docs:
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/worklog.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/progress.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/schema-contract.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/verification-matrix.md`
  - `/Users/rohan/Desktop/Projects/codealmanac/docs/codealmanac-launch/next-agent-brief.md`

**Commit Plan:**
1. Hosted: `feat: add repository trigger policies`
2. Local docs: `docs: record hosted trigger policy slice`
3. Push both branches.
4. Send RelayForge update.
