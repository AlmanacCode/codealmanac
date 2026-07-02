# Next Agent Brief

Status: active.
Updated: 2026-07-02.

## Current Hypothesis

Build the launch in substantial slices. Each slice needs a plan, code, focused
verification, launch-folder updates, commit, and push.

## Last Completed Slice

Slice 26 implemented the hosted WorkOS/AuthKit API foundation.

Implemented:

- hosted worktree at
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
- hosted branch `codex/workos-authkit-api-foundation`
- Next.js AuthKit session ownership through `AuthKitProvider`, AuthKit proxy
  composition, `/sign-in`, `handleAuth(...)` callback, and POST server-action
  sign-out
- frontend server auth helpers that forward WorkOS access tokens to FastAPI
- backend WorkOS bearer-token verification through JWKS
- hosted user ids stored as `workos_user_id text` instead of
  `supabase_user_id uuid`
- CLI token, conversation-source, events, analytics, and migration surfaces
  updated to use WorkOS user ids
- active Supabase Auth helper/client paths removed from hosted auth wiring

Verified:

```text
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run pytest tests/test_identity_auth_contract.py tests/test_identity_api_contract.py tests/test_hosted_conversation_sync_contract.py tests/test_store_timestamps_contract.py tests/test_analytics_contract.py -q
uv run pytest tests/test_architecture_contract.py tests/test_repositories_api_contract.py tests/test_wiki_api_contract.py tests/test_repositories_contract.py tests/test_updates_contract.py tests/test_wiki_contract.py -q

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run test:frontend
npm run build
```

`npm run build` still prints the known non-blocking CSS optimizer warning about
a comment containing `m-* utility`.

## Next Pressure Test

The next substantial slice should either:

- build the versioned public API and CLI login/capture credential flow on top
  of the WorkOS bearer-token foundation, or
- build hosted worker/run storage parity: SQL-backed `runs`, `run_events`,
  bundle/result storage by reference, and cloud/local naming parity.

Before coding, write the next slice plan under `docs/plans/`, then implement
the full slice, update this brief, update `progress.md`, send a RelayForge
progress update, commit, and push.

## Known Repo State

The CodeAlmanac branch is `dev`. Slice 24 implementation commit `38423978`,
Slice 24 bookkeeping commit `d9a55b9e`, and Slice 25 bookkeeping commit
`ad5792d7` are pushed to `origin/dev`.

The hosted auth branch is
`/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
on `codex/workos-authkit-api-foundation`, pushed to origin at commit
`5858ae1 feat: migrate hosted auth to WorkOS`.

Slice 25 hosted convergence branch `codex/hosted-baseline-convergence` is
pushed to origin at commit `1d237db`.

The local wiki command currently fails on this checkout with:

```text
almanac: table pages has no column named archived_at
```

Use source files and launch docs as the authority until the wiki index health is
repaired.
