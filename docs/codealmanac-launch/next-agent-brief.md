# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

## Last Completed Slice

Slice 37 added cloud run CLI mirrors.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- hosted CLI-token run read routes:
  `GET /v1/repositories/{repo_id}/runs`,
  `GET /v1/runs/{run_id}`, and
  `GET /v1/runs/{run_id}/events`
- CodeAlmanac `cloud_runs` service and typed HTTP adapter methods
- current-checkout cloud run workflow for listing repo runs
- run-id-only cloud run detail and log workflows
- public CLI commands:
  `codealmanac runs list`,
  `codealmanac runs show <run-id>`, and
  `codealmanac runs logs <run-id>`
- pushed hosted commit
  `168f9b2 feat: add CLI run read routes`
- pushed CodeAlmanac commit
  `bc177cf2 feat: inspect cloud runs from CLI`

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_cli_runs_api_contract.py tests/test_repositories_api_contract.py tests/test_updates_contract.py -q
uv run ruff check .
uv run python -m compileall src modal_app -q
uv run pytest -q

cd /Users/rohan/Desktop/Projects/codealmanac
uv run pytest tests/test_cloud_runs_service.py tests/test_cloud_runs_workflow.py tests/test_cli.py tests/test_architecture.py -q
uv run ruff check .
uv run python -m compileall src -q
uv run pytest -q
```

Counts: hosted backend focused `40 passed, 1 warning`; hosted backend full
`326 passed, 1 warning`; CodeAlmanac focused `121 passed`; CodeAlmanac full
`490 passed`.

## Next Pressure Test

Choose the next launch-hardening slice between terminal run fanout,
setup/onboarding entrypoints, cloud run start/cancel/retry semantics, and
frontend onboarding changes.

Pressure points:

- terminal failed/stale runs still do not have a dedicated `RunFailed` or
  `RunStale` domain-event fanout for GitHub check updates
- CLI commands list/show/log cloud runs, but do not start/cancel/retry them
- browser setup/onboarding entrypoints still need the new cloud setup flow
- old inline-message conversation routes should remain compatibility-only

## Known Repo State

The CodeAlmanac branch is `dev`. Slice 31 is pushed to `origin/dev` at
`f20e928d feat: expose maintenance package api`; Slice 36 is pushed to
origin at `8ca50e0f feat: mirror cloud repository triggers in CLI`; Slice 37
is pushed to origin at `bc177cf2 feat: inspect cloud runs from CLI`.

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
origin at `1b00b63 feat: add repository trigger policies`; Slice 36 is pushed
to origin at `fbf8b5a feat: add CLI repository trigger routes`; Slice 37 is
pushed to origin at `168f9b2 feat: add CLI run read routes`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
