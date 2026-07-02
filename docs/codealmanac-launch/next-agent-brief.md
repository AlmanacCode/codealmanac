# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

## Last Completed Slice

Slice 47 made repository setup understandable from the hosted dashboard without
relying on CLI output alone.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- `backend/src/almanac/server/capture_router.py` exposes browser-authenticated
  `GET /api/capture/status`
- the route returns `CaptureStatusDTO` and does not return raw capture tokens
- `frontend/src/lib/api/server.ts` exposes `getCaptureStatus()`
- `frontend/src/components/repositories/setup-summary.tsx` renders GitHub App
  access, repository access, capture credential state, maintained branches, and
  delivery readiness from real DTOs
- the repository settings page fetches account, repo, branches, trigger
  policies, and capture status before rendering the summary and existing form
- hosted commit `2102d38 feat: add repository setup summary` is pushed to
  `origin/codex/workos-authkit-api-foundation` and hosted `main`

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_capture_tokens_api_contract.py tests/test_repositories_api_contract.py -q
uv run ruff check .
uv run pytest -q
uv run python -m compileall src modal_app -q

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run test:frontend
npm run lint
npm run build
```

Counts for Slice 47: focused backend tests `15 passed, 1 warning`; full backend
tests `356 passed, 1 warning`; frontend routes `27 passed`; frontend
components `52 passed`. Frontend build retained the known CSS optimizer warning
about `m-* utility`.

## Next Pressure Test

Choose the next launch-hardening slice between WorkOS/library alignment, setup
CTA refinement, real authenticated browser verification, and provider cleanup.

Pressure points:

- new steering rule: do not hand-roll a provider flow when a trusted public
  library owns it; follow the provider documentation directly and avoid
  parallel paths
- the repository setup summary is live, but it has not been exercised through a
  real signed-in production browser session in this slice
- setup CTAs may need one more pass so browser setup and CLI setup do not feel
  like competing paths
- old inline-message conversation routes should remain compatibility-only
- old Modal app `usealmanac-updates` is still deployed; retire it only in an
  explicit provider cleanup step
- dirty `/Users/rohan/Desktop/Projects/usealmanac` still exists and should not
  be used for launch work until cleaned or renamed

## Known Repo State

The CodeAlmanac branch is `dev`. Slice 31 is pushed to `origin/dev` at
`f20e928d feat: expose maintenance package api`; Slice 36 is pushed to
origin at `8ca50e0f feat: mirror cloud repository triggers in CLI`; Slice 37
is pushed to origin at `bc177cf2 feat: inspect cloud runs from CLI`; Slice 38
is pushed to origin at `117b36db feat: open cloud pages from CLI`; Slice 39
is pushed to origin at `0e3879e1 feat: start cloud runs from CLI`; Slice 44 is
pushed to origin at `a7cbc7d5 feat: cancel cloud runs from CLI`; the latest
cloud-run retry commit is `af7953c6 feat: retry cloud runs from CLI`.

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
pushed to origin at `168f9b2 feat: add CLI run read routes`; Slice 38 is
pushed to origin at `ed7e765 feat: add cloud route handoff`; Slice 39 is
pushed to origin at `14caf8b feat: start cloud runs from CLI`; Slice 40 is
pushed to origin at `8795849 feat: emit terminal run events`; Slice 41 is
pushed to origin at `a781e51 chore: align hosted product identity`; Slice 42 is
pushed to origin at `97564f7 feat: publish terminal run checks`; Slice 43 is
pushed to origin at `eafe60c feat: align cloud setup copy`; Slice 44 is pushed
to origin at `0e17a34 feat: cancel cloud update runs`; Slice 45 is pushed to
origin at `b3535cd feat: retry cloud update runs`; Slice 46 is pushed to
origin at `7b35cc9 feat: add dashboard run actions`; Slice 47 is pushed to
origin at `2102d38 feat: add repository setup summary`. Hosted `main` is also
fast-forwarded to `2102d38`, Render service `srv-d8g8nb37uimc739vnnsg` is live
on deploy `dep-d939qpbtqb8s73fg7c9g`, and Vercel production is live at
`https://www.codealmanac.com` from deployment
`https://codealmanac-hosted-3wf3uccd1-thealmanac.vercel.app`.

CodeAlmanac Slice 45 is pushed to `origin/dev` at
`af7953c6 feat: retry cloud runs from CLI`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
