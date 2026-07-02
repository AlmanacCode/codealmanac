# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, push, and RelayForge update.

## Last Completed Slice

Slice 48 aligned the hosted WorkOS/AuthKit API boundary with provider
documentation and the launch hierarchy rule.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- `backend/src/almanac/server/deps.py` uses FastAPI `HTTPBearer` for bearer
  parsing instead of hand-rolled `Authorization` header string parsing
- `backend/src/almanac/integrations/workos/client.py` documents why this
  boundary uses WorkOS JWKS + PyJWT rather than WorkOS Python sealed-session
  helpers
- `WorkOSClaims` mirrors the documented AuthKit access-token shape for
  organization, role, permissions, entitlements, and feature flags
- architecture tests now prevent regression to custom bearer parsing
- hosted commit `c68d448 refactor: align workos auth boundary` is pushed to
  `origin/codex/workos-authkit-api-foundation` and hosted `main`

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_identity_auth_contract.py tests/test_api_error_contract.py tests/test_architecture_contract.py -q
uv run ruff check .
uv run pytest -q
uv run python -m compileall src modal_app -q

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run lint
npm run build
```

Counts for Slice 48: focused backend tests `86 passed, 1 warning`; full backend
tests `357 passed, 1 warning`; frontend routes `27 passed`. Frontend build
retained the known CSS optimizer warning about `m-* utility`.

## Next Pressure Test

Choose the next launch-hardening slice between setup CTA refinement, real
authenticated browser verification, provider cleanup, and token-storage
hardening.

Pressure points:

- new steering rule: concept hierarchy and dependency direction are part of
  correctness; do not flatten browser sessions, API bearer tokens, CLI tokens,
  and capture credentials into one vague auth bucket
- the repository setup summary is live, but it has not been exercised through a
  real signed-in production browser session in this slice
- GitHub OAuth/user tokens are still stored as product DB columns; token
  storage hardening is a launch security pressure point
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
origin at `2102d38 feat: add repository setup summary`; Slice 48 is pushed to
origin at `c68d448 refactor: align workos auth boundary`. Hosted `main` is
also fast-forwarded to `c68d448`, Render service
`srv-d8g8nb37uimc739vnnsg` is live on deploy
`dep-d93a2c6k1jcs73ab8qg0`, and Vercel production is live at
`https://www.codealmanac.com` from deployment
`https://codealmanac-hosted-qejqttlne-thealmanac.vercel.app`.

CodeAlmanac Slice 45 is pushed to `origin/dev` at
`af7953c6 feat: retry cloud runs from CLI`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
