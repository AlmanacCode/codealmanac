# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

## Last Completed Slice

Slice 34 exposed hosted run-event visibility through the API and dashboard.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- `RunEventDTO`
- `GET /api/runs/{run_id}/events`
- `Updates.run_events_for_user(...)` and
  `UpdateQueries.run_events_for_user(...)`
- repository authorization before run-event reads
- frontend `RunEventDTO`, `listRunEvents(runId)`, and BFF allowlist path
  `GET /api/dashboard/runs/<uuid>/events`
- expandable dashboard `RunRow` event timeline with kind, relative time,
  message, and normalized payload fields
- pushed hosted commit `4e4c94b feat: expose run event timeline`

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_updates_contract.py tests/test_repositories_api_contract.py tests/test_update_run_events_contract.py -q
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
```

Counts: hosted backend focused `35 passed, 1 warning`; hosted backend full
`312 passed, 1 warning`; hosted frontend `43 passed` and route tests
`26 passed`.

## Next Pressure Test

Choose the next launch-hardening slice between terminal run fanout and
dashboard onboarding/configuration.

Pressure points:

- terminal failed/stale runs still do not have a dedicated `RunFailed` or
  `RunStale` domain-event fanout for GitHub check updates
- repository onboarding/configuration screens still need the new cloud setup
  flow and branch/delivery controls
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
to origin at `4e4c94b feat: expose run event timeline`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
