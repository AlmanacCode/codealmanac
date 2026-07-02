# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

## Last Completed Slice

Slice 35 added hosted maintained-branch trigger policies.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- `repository_trigger_policies`, keyed by `(repo_id, branch)`
- `RepositoryTriggerPolicy` models, table/store/service, API DTOs, and RLS
- account-scoped trigger routes:
  `GET /api/accounts/{account_id}/repositories/{repo_id}/triggers` and
  `PUT /api/accounts/{account_id}/repositories/{repo_id}/triggers`
- branch-push update planning from normalized GitHub `BranchPushed` events
- policy-driven branch delivery: `commit` -> `CommitToBranch`; `pr` ->
  `OpenWikiPullRequest`
- repository settings UI for maintained branches and per-branch delivery mode
- fixed the Atlas design-lab mock to include `stale` status so production build
  passes
- pushed hosted commit `1b00b63 feat: add repository trigger policies`

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_repositories_contract.py tests/test_repositories_api_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
python -m compileall src modal_app -q

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
git diff --check

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run lint
npm run test:frontend
npm run test:routes
npm run build
```

Counts: hosted backend focused `118 passed, 1 warning`; hosted backend full
`320 passed, 1 warning`; hosted frontend `44 passed`, route tests
`26 passed`, and build passed with the known CSS optimizer warning about
`m-* utility`.

## Next Pressure Test

Choose the next launch-hardening slice between CLI trigger mirrors, terminal
run fanout, and setup/onboarding entrypoints.

Pressure points:

- terminal failed/stale runs still do not have a dedicated `RunFailed` or
  `RunStale` domain-event fanout for GitHub check updates
- CLI commands do not yet mirror trigger policy reads/writes
- browser setup/onboarding entrypoints still need the new cloud setup flow
- old inline-message conversation routes should remain compatibility-only

## Known Repo State

The CodeAlmanac branch is `dev`. Slice 31 is pushed to `origin/dev` at
`f20e928d feat: expose maintenance package api`.

The hosted auth branch is
`/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
on `codex/workos-authkit-api-foundation`. Slice 27 is pushed to origin at
`c91e162 feat: add v1 CLI auth routes`; Slice 28 is pushed to origin at
`36211ba feat: add capture credential API`; Slice 29 is pushed to origin at
`5644a65 feat: add capture transcript upload`; Slice 30 is pushed to origin at
`191d8d8 feat: materialize capture source refs`; Slice 31 is pushed to origin
at `51c2cb2 feat: call codealmanac maintenance api`; Slice 32 is pushed to
origin at `12cfc08 feat: persist hosted run events`; Slice 33 is pushed to
origin at `9098b65 feat: record stale delivery outcomes`; Slice 34 is pushed
to origin at `4e4c94b feat: expose run event timeline`; Slice 35 is pushed to
origin at `1b00b63 feat: add repository trigger policies`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
