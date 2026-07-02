# Slice 26 WorkOS AuthKit And API Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hosted Supabase Auth boundary with WorkOS/AuthKit and make
FastAPI verify WorkOS access tokens for the existing dashboard and CLI-login
API surface.

**Architecture:** The Next.js app owns browser session management through
AuthKit. The frontend forwards WorkOS access tokens to FastAPI as bearer
tokens. FastAPI verifies those tokens against WorkOS JWKS, maps `sub` to
`workos_user_id`, and stores GitHub user tokens against that WorkOS user id.
Supabase remains only the Postgres/storage provider, not the identity provider.

**Tech Stack:** Next.js 16 App Router, `@workos-inc/authkit-nextjs`,
`@workos-inc/node`, FastAPI, PyJWT/JWKS, SQLModel, `workos` Python SDK, pytest,
Node route contract tests.

**Status:** Completed on 2026-07-02.

---

## Source References Read

- WorkOS AuthKit Next.js README:
  `https://raw.githubusercontent.com/workos/authkit-nextjs/main/README.md`
- WorkOS Python README:
  `https://raw.githubusercontent.com/workos/workos-python/main/README.md`
- WorkOS AuthKit sessions docs:
  `https://workos.com/docs/authkit/sessions`
- WorkOS AuthKit session token reference:
  `https://workos.com/docs/reference/authkit/session-tokens`

## Product Decisions

- Cloud identity becomes WorkOS/AuthKit now.
- Do not preserve Supabase Auth as a long-term identity bridge.
- There are no real users to migrate, so the hosted `users` table can change
  from `supabase_user_id uuid` to `workos_user_id text`.
- Browser auth state stays in the Next app. Backend API routes only receive
  bearer tokens.
- GitHub repo reads/writes still use GitHub App/user tokens. WorkOS is the
  human identity/session provider, not the GitHub delivery mechanism.
- Provider OAuth tokens from WorkOS callback are passed to the backend only for
  linking the GitHub user token pair.

## Hosted Worktree

```text
/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
branch: codex/workos-authkit-api-foundation
base: codex/hosted-baseline-convergence
```

## Task 1: Install WorkOS SDKs And Remove Frontend Supabase Auth

Files:

- Modify `frontend/package.json`
- Modify `frontend/package-lock.json`
- Delete `frontend/src/lib/supabase/client.ts`
- Delete `frontend/src/lib/supabase/server.ts`
- Modify `frontend/src/lib/config.ts`

Steps:

1. Install `@workos-inc/authkit-nextjs` and `@workos-inc/node`.
2. Remove frontend `@supabase/ssr` and `@supabase/supabase-js`.
3. Replace frontend Supabase config exports with WorkOS/AuthKit-facing config
   only where local code needs explicit values.
4. Verify no frontend production source imports `@supabase/*` or
   `src/lib/supabase`.

## Task 2: Move The Next App To AuthKit

Files:

- Modify `frontend/src/app/layout.tsx`
- Modify `frontend/src/proxy.ts`
- Modify `frontend/src/app/login/page.tsx`
- Modify `frontend/src/app/auth/callback/route.ts`
- Create `frontend/src/app/sign-in/route.ts`
- Create `frontend/src/app/auth/actions.ts`
- Modify `frontend/src/components/shell/user-menu.tsx`
- Modify `frontend/src/app/api/dashboard/[...path]/route.ts`
- Modify `frontend/src/app/cli-login/page.tsx`
- Modify `frontend/src/lib/api/server.ts`
- Create `frontend/src/lib/auth/server.ts`
- Modify `frontend/src/app/dashboard/accounts/[accountId]/layout.tsx`

Steps:

1. Wrap the root layout with `AuthKitProvider`.
2. Replace the Supabase proxy with AuthKit composable proxy logic:
   `authkit(request)` and `handleAuthkitHeaders(...)`.
3. Keep the dashboard account cookie logic in the proxy after AuthKit session
   lookup.
4. Protect `/dashboard/:path*` and `/api/dashboard/:path*`.
5. Replace the login button with a link or button that starts `/sign-in`.
6. Add `/sign-in` using `getSignInUrl()`.
7. Replace callback logic with `handleAuth({ returnPathname: "/dashboard",
   onSuccess })`.
8. In `onSuccess`, call the backend link endpoint with the WorkOS access token
   and the returned GitHub OAuth token pair.
9. Add `getAccessToken()` and `getSessionEmail()` wrappers over AuthKit
   `withAuth()`.
10. Replace BFF and server API calls to import the AuthKit-backed
    `getAccessToken()`.
11. Replace sign-out with a POST server action using WorkOS `signOut()`.

## Task 3: Add Backend WorkOS Token Verification

Files:

- Modify `backend/pyproject.toml`
- Modify `backend/uv.lock`
- Create `backend/src/almanac/integrations/workos/__init__.py`
- Create `backend/src/almanac/integrations/workos/client.py`
- Modify `backend/src/almanac/settings.py`
- Modify `backend/src/almanac/app.py`
- Modify `backend/src/almanac/server/deps.py`

Steps:

1. Add Python `workos` dependency if needed for the typed client/JWKS URL.
2. Add `workos_client_id`, `workos_api_key`, and `workos_issuer` settings.
3. Implement a policy-free WorkOS integration that verifies access JWTs against
   the WorkOS JWKS URL and returns shaped claims.
4. Validate `sub`, `client_id`, `iss`, `exp`, and `iat`.
5. Map invalid tokens to `NotAuthenticated` and upstream/JWKS failures to
   `ProviderUnavailable`.
6. Wire the WorkOS adapter in `create_almanac()`.
7. Keep route dependencies thin: `current_user` still calls
   `almanac.identity.users.authenticate(token)`.

## Task 4: Change User Identity Storage To WorkOS IDs

Files:

- Modify `backend/src/almanac/core/models.py`
- Modify `backend/src/almanac/services/identity/users/tables.py`
- Modify `backend/src/almanac/services/identity/users/store.py`
- Modify `backend/src/almanac/services/identity/users/service.py`
- Modify `backend/src/almanac/services/cli_tokens/tables.py`
- Modify `backend/src/almanac/services/cli_tokens/models.py`
- Modify `backend/src/almanac/services/cli_tokens/store.py`
- Modify `backend/src/almanac/services/cli_tokens/service.py`
- Modify `backend/src/almanac/services/conversations/tables.py`
- Modify `backend/src/almanac/services/conversations/models.py`
- Modify `backend/src/almanac/services/conversations/service.py`
- Modify `backend/src/almanac/services/events/models.py`
- Modify `backend/src/almanac/services/analytics/service.py`
- Modify `backend/src/almanac/app.py`

Steps:

1. Rename the durable user identity field to `workos_user_id: str`.
2. Update user table primary key and foreign keys to point at
   `users.workos_user_id`.
3. Keep GitHub token fields unchanged.
4. Update CLI token authorization and conversation source ownership to use
   `workos_user_id`.
5. Rename analytics event fields from Supabase to WorkOS.
6. Keep `github_user_id` and `github_login` unchanged for product behavior.

## Task 5: Rewrite Auth Tests And Route Contracts

Files:

- Modify `backend/tests/test_identity_auth_contract.py`
- Modify `backend/tests/test_identity_api_contract.py`
- Modify `backend/tests/test_hosted_conversation_sync_contract.py`
- Modify `backend/tests/test_store_timestamps_contract.py`
- Modify all backend tests constructing `User(...)`
- Modify `frontend/tests/routes.test.mjs`

Steps:

1. Replace Supabase adapter tests with WorkOS access-token verifier tests.
2. Prove `Users.authenticate()` looks up by WorkOS `sub`.
3. Prove `link_github_app_session()` stores provider tokens against the WorkOS
   user id.
4. Prove route contracts no longer import Supabase client/server helpers.
5. Prove callback uses `handleAuth` and persists `oauthTokens`.
6. Prove BFF/server API uses AuthKit-backed `getAccessToken()`.

## Task 6: Rewrite Supabase Migrations For The New Identity Shape

Files:

- Modify `supabase/migrations/20260620000000_init.sql`
- Modify `supabase/migrations/20260628000000_hosted_conversation_sync.sql`
- Modify migration contract tests

Steps:

1. Replace `users.supabase_user_id uuid` with `users.workos_user_id text`.
2. Replace user foreign keys in CLI token and conversation tables.
3. Remove Supabase Auth naming from comments and policies.
4. Preserve service-role-only RLS policy behavior.

## Task 7: Verify And Commit

Commands:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_identity_auth_contract.py tests/test_identity_api_contract.py tests/test_hosted_conversation_sync_contract.py tests/test_store_timestamps_contract.py tests/test_architecture_contract.py
uv run pytest
uv run ruff check .
uv run ruff format --check .

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/frontend
npm run test:routes
npm run test:frontend
npm run build

cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence
git diff --check
git status --short
```

## Bookkeeping After Implementation

Update these CodeAlmanac launch files:

- `docs/codealmanac-launch/auth-api-contract.md`
- `docs/codealmanac-launch/progress.md`
- `docs/codealmanac-launch/worklog.md`
- `docs/codealmanac-launch/verification-matrix.md`
- `docs/codealmanac-launch/next-agent-brief.md`

Send RelayForge with the exact verification and new percentages, then commit
and push both hosted implementation and CodeAlmanac launch bookkeeping.

## Implementation Notes

- Installed `@workos-inc/authkit-nextjs`, `@workos-inc/node`, and Python
  `workos`.
- Removed the active Supabase Auth client/helper path from frontend and
  backend production auth code.
- Wrapped the Next app in `AuthKitProvider`.
- Added AuthKit proxy composition, `/sign-in`, `handleAuth` callback, and POST
  server-action sign-out.
- Forwarded WorkOS access tokens from frontend server code to FastAPI.
- Added a WorkOS integration that verifies access tokens through JWKS and maps
  `sub` to `workos_user_id`.
- Changed hosted user identity storage from `supabase_user_id uuid` to
  `workos_user_id text`.
- Updated CLI token, conversation-source, event, analytics, and migration
  surfaces to use WorkOS user ids.
- Preserved GitHub repo reads/writes through GitHub App/user tokens rather than
  broad GitHub OAuth scopes.

## Verification Result

Backend:

```text
uv run pytest tests/test_identity_auth_contract.py tests/test_identity_api_contract.py tests/test_hosted_conversation_sync_contract.py tests/test_store_timestamps_contract.py tests/test_analytics_contract.py -q
31 passed, 1 warning

uv run pytest tests/test_architecture_contract.py tests/test_repositories_api_contract.py tests/test_wiki_api_contract.py tests/test_repositories_contract.py tests/test_updates_contract.py tests/test_wiki_contract.py -q
126 passed, 1 warning

uv run pytest
286 passed, 1 warning

uv run ruff check .
All checks passed

uv run ruff format --check .
254 files already formatted
```

Frontend:

```text
npm run test:routes
26 passed

npm run test:frontend
41 passed

npm run build
passed
```

Final checks:

```text
rg -n "supabase|Supabase|SUPABASE|AuthClaims|src/lib/supabase|@supabase|signInWithGitHub|exchangeCodeForSession|createServerClient" backend/src frontend/src frontend/tests backend/tests Makefile -g '!frontend/node_modules/**' -g '!backend/.venv/**'
only expected route-test, fixture, and migration-folder references remained

rg -n "workos_user_id uuid|user_id uuid not null references public.users\(workos_user_id\)|authorized_user_id uuid|workos_user_id: UUID|workos_user_id=uuid4\(|workos_user_id = uuid4\(|user_id=uuid4\(\)" backend/src backend/tests supabase/migrations -g '!backend/.venv/**'
no output

git diff --check
no output
```

`npm run build` still prints the pre-existing CSS optimizer warning about a
comment containing `m-* utility`; it is non-blocking and not introduced by this
slice.
