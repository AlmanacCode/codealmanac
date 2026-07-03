# Auth And API Contract

Status: active.

This is the launch contract for cloud auth and public API design.

## Decision

Use WorkOS/AuthKit as the cloud identity provider.

WorkOS owns:

```text
users
organizations
memberships
roles
sessions
CLI/device auth
access token refresh
machine credentials where useful
organization API keys if a concrete workflow needs them
```

CodeAlmanac owns:

```text
repositories
branches
trigger policies
source capture records
runs
run events
deliveries
wiki read models
billing linkage
```

Do not preserve Supabase Auth as the long-term identity system. Supabase may
remain the database/storage provider.

## Current Provider State

Checked from this workspace on 2026-07-02:

```text
workos CLI on PATH: no
WorkOS CLI through npx: yes, `WORKOS_MODE=agent npx -y workos --help --json`
Doppler project codealmanac: exists
codealmanac dev/prd WorkOS secret names: not present
Doppler project almanac dev/prd WorkOS secret names: present
WorkOS project codealmanac: created by user
WorkOS environment model: one production environment for now
```

The older `../almanac` project has WorkOS setup material and provider secrets.
Those should be used as reference material. For CodeAlmanac, creating a fresh
WorkOS application/environment is acceptable and likely cleaner than reusing the
old app directly.

The CodeAlmanac Doppler WorkOS values should point at the new WorkOS
`codealmanac` project once its API key and client id are available.
The user provided the production WorkOS API key and client id for this project
on 2026-07-02. Do not record those secret values in docs.

Configured Doppler secret names for `codealmanac` configs `dev`,
`dev_personal`, `stg`, and `prd`:

```text
WORKOS_API_KEY
WORKOS_CLIENT_ID
WORKOS_COOKIE_PASSWORD
WORKOS_REDIRECT_URI
NEXT_PUBLIC_WORKOS_REDIRECT_URI
```

These configs intentionally share the same WorkOS project/environment values.
The stale copied `WORKOS_ISSUER` value was removed because AuthKit does not use
it in the current launch contract.

Confirmed callback targets:

```text
production: https://www.codealmanac.com/auth/callback
local: http://localhost:3000/auth/callback
```

Configured WorkOS application settings:

```text
redirect URI: https://www.codealmanac.com/auth/callback
redirect URI: http://localhost:3000/auth/callback
CORS origin: https://www.codealmanac.com
CORS origin: http://localhost:3000
homepage URL: https://www.codealmanac.com
```

## CLI Login

`codealmanac login` and the login part of `codealmanac setup` use WorkOS CLI
Auth through a thin CodeAlmanac API wrapper.

The wrapper is intentional. The CLI should not know WorkOS SDK details, WorkOS
environment ids, or provider-specific response shapes. The CLI talks to
CodeAlmanac product endpoints; the CodeAlmanac backend delegates device
authorization, token exchange, and refresh to WorkOS, then maps the resulting
WorkOS identity into CodeAlmanac product permissions.

Flow:

```text
CLI -> POST /v1/auth/cli/start
API -> WorkOS create_device / CLI Auth device authorization
CLI -> opens WorkOS verification URL and prints fallback code
user -> approves in browser
CLI -> polls POST /v1/auth/cli/sessions/{session_id}/poll
API -> WorkOS authenticate_with_device_code
API -> returns WorkOS-backed access_token and refresh_token
CLI -> stores local WorkOS-backed auth state
```

Local auth state lives under `~/.codealmanac/`.

Preferred storage:

```text
macOS Keychain for secrets
~/.codealmanac/config.json for non-secret config
```

Fallback storage:

```text
~/.codealmanac/auth.json mode 0600
```

Implemented Slice 27 storage:

```text
~/.codealmanac/auth.json mode 0600
```

Stored state:

```text
api_url
github_user_id
github_login
access_token
refresh_token
organization_id when present
logged_in_at
```

The local CLI does not store WorkOS browser session cookies.

Implemented Slice 59 CLI behavior:

```text
auth.json writes: access_token, refresh_token when present
auth.json reads: access_token, accessToken, token, refresh_token, refreshToken
```

The CLI still talks to CodeAlmanac product endpoints, not WorkOS directly. The
stored token shape now matches the WorkOS-backed API response shape, while
legacy `token` files remain readable so existing installs can migrate on the
next login/status command.

## Capture Credentials

Capture hooks should not use an unrestricted human browser token.

After browser consent, the API should create or return a narrow WorkOS-backed
machine credential for capture:

```text
scope: capture:write
bound user
bound machine installation
optional bound organization/repo set
revocable from dashboard
```

Implemented Slice 28 launch shape:

```text
WorkOS/AuthKit owns human identity and browser sessions.
CodeAlmanac-hosted currently issues narrow `cap_...` capture credentials.
CLI token auth gates capture credential issue/status/revoke.
Capture credentials are product machine credentials, not WorkOS browser tokens.
```

This is no longer the desired long-term shape. Capture credentials should move
to WorkOS API Keys or the closest WorkOS machine credential primitive. Keep
CodeAlmanac issue/status/revoke endpoints as the product API wrapper, but do not
maintain a separate durable token system unless WorkOS cannot express the needed
scope, revocation, or audit behavior.

## GitHub OAuth Through WorkOS

Launch sign-in should be GitHub-only in AuthKit. Email/password, magic auth,
and generic SSO should remain disabled unless explicitly reopened; repository
access still comes from the GitHub App installation token, not broad user OAuth
scopes.

Email verification is not a supported launch step. A successful CodeAlmanac
cloud login must go through GitHub OAuth because the AuthKit callback needs
WorkOS' returned GitHub provider tokens to link the user to GitHub and to
hydrate the product identity. Email/password or magic-auth callbacks can create
a WorkOS browser session but do not provide those GitHub provider tokens, so
they are treated as misconfigured auth paths rather than alternate sign-in
methods.

Enable WorkOS' GitHub OAuth token return setting. In the AuthKit callback,
persist upstream `oauthTokens` from `handleAuth({ onSuccess })` when present.
This replaces the old Supabase callback behavior where `provider_token` and
`provider_refresh_token` were sent to the backend.

Docs-backed setup contract:

```text
browser -> /sign-in
/sign-in -> AuthKit getSignInUrl()
AuthKit -> GitHub OAuth provider
GitHub -> WorkOS GitHub OAuth Redirect URI
WorkOS -> /auth/callback
/auth/callback -> handleAuth({ onSuccess })
onSuccess -> send WorkOS accessToken + GitHub oauthTokens to backend
backend -> verify WorkOS AuthKit access token, then store GitHub token pair
```

The frontend should use WorkOS' standard Next.js SDK helpers:

```text
getSignInUrl() in the sign-in route
handleAuth() in the callback route
AuthKitProvider in the app layout
authkitProxy/authkit middleware or proxy for session handling
```

Do not hand-roll the OAuth callback, state verifier, or PKCE cookie. If the
provider setup is correct, the callback should be boring.

The backend should verify the WorkOS/AuthKit bearer as an AuthKit session token:

```text
verify JWT signature against WorkOS JWKS
require normal session claims such as subject, issuer, issued-at, and expiry
accept the WorkOS/AuthKit issuer shape used by the SDK/runtime
do not require GitHub oauthTokens to be embedded in the WorkOS access token
do not require a non-documented `client_id` claim as a hard auth condition
reject wrong client_id if WorkOS includes one
```

GitHub provider tokens are not the browser session. They are upstream provider
tokens returned during the AuthKit callback and stored only after the WorkOS
session bearer verifies.

Production schema drift note from Slice 58:

```text
symptom: /login?error=github_required after GitHub OAuth
actual failing hop: POST /api/auth/github-app/session
root cause: production users table still had supabase_user_id
fix: repair production DB to workos_user_id plus encrypted token columns
tracking migration: 20260703000000_repair_workos_identity_schema.sql
```

If sign-in fails after WorkOS/GitHub redirects have succeeded, check backend
logs and the production `users` schema before adding AuthKit retry machinery.
The simplest correct path is the documented SDK callback plus a matching
database schema.

Default GitHub OAuth scope:

```text
user:email
```

Reason:

```text
required for reliable GitHub email identity during sign-in
```

Do not add broad OAuth scopes such as `repo` for normal product operation.
Repository reads, writes, PRs, branch checks, and delivery should use GitHub App
installation tokens and GitHub App permissions. Add user OAuth scopes only for a
specific user-on-behalf-of-user feature that cannot be served by the GitHub App.

When using a GitHub App as the WorkOS GitHub OAuth credential, GitHub App user
access tokens do not use OAuth scopes in the classic OAuth App sense. They are
bounded by the intersection of the GitHub App permissions and the user's own
permissions. Keep the WorkOS scope field simple unless a concrete user-token
feature requires more.

GitHub App optional feature:

```text
User-to-server token expiration: enabled
```

Reason:

```text
GitHub returns ghu_ access tokens that expire after 8 hours and ghr_ refresh
tokens that can refresh them. CodeAlmanac needs the refresh token path for
stable user-linked GitHub identity and repository visibility.
```

GitHub App installation OAuth prompt:

```text
Request user authorization during installation: off by default
```

Reason:

```text
The normal user identity path is WorkOS/AuthKit sign-in. Installation is the
repo permission path. If we enable OAuth during installation, GitHub starts a
separate web application flow and chooses the first app callback unless the full
flow controls redirect_uri. Keep identity and installation separate unless we
intentionally redesign onboarding around installation-first auth.
```

Provider config that should stay simple:

```text
WorkOS GitHub provider enabled
WorkOS GitHub provider uses GitHub App client id and client secret
Return GitHub OAuth tokens enabled
scope user:email
GitHub App callback URL is the WorkOS GitHub OAuth Redirect URI
GitHub App setup URL is https://www.codealmanac.com/setup
GitHub App webhook URL is https://api.codealmanac.com/api/webhooks/github
```

Production environment contract:

```text
WORKOS_API_KEY
WORKOS_CLIENT_ID
WORKOS_COOKIE_PASSWORD
NEXT_PUBLIC_WORKOS_REDIRECT_URI
```

`WORKOS_COOKIE_PASSWORD` must be at least 32 characters because the AuthKit
Next.js SDK uses it to encrypt the session cookie. An empty value is a broken
deployment even when the WorkOS and GitHub dashboards are otherwise correct.

Empirical check on 2026-07-02 against `codealmanac/prd`: after refreshing the
stored GitHub App user token for `rohans0509`, GitHub returned an empty
`X-OAuth-Scopes` header and still allowed:

```text
GET /user
GET /user/installations
GET /installation/repositories through app installation tokens
GET /orgs/{org}/memberships/{username}
GET /repos/{owner}/{repo}/collaborators/{username}/permission
```

The probe listed installed repositories under `ReverieOne` and `AlmanacCode`,
including private repositories, without adding `repo` scope.

Implementation rule: if a GitHub App user token receives `401 Bad credentials`
and a refresh token is present, attempt refresh and persist the rotated token
even when `token_expires_at` is null. The current old backend only refreshes
when an expiry timestamp is set, which misses invalid no-expiry tokens.

## GitHub Provider Token Storage

GitHub provider OAuth tokens are stored as ciphertext in cloud SQL:

```text
users.oauth_token_ciphertext
users.refresh_token_ciphertext
```

The domain `User` model still carries decrypted `oauth_token` and
`refresh_token` after crossing the `UsersStore` boundary because downstream
GitHub integrations need bearer strings for provider calls. Raw database rows
must not expose plaintext provider tokens.

Slice 49 launch implementation:

```text
primitive: cryptography Fernet / MultiFernet
setting: GITHUB_TOKEN_ENCRYPTION_KEYS
composition root: backend/src/almanac/app.py
store boundary: backend/src/almanac/services/identity/users/store.py
secret module: backend/src/almanac/services/identity/users/secrets.py
```

Key format:

```text
comma-separated Fernet keys
first key encrypts
all listed keys decrypt
```

This supports rotation by prepending a new key while keeping old keys for
decrypt. Re-encryption/rotation machinery is deferred until there are real
tokens that need migration.

WorkOS Vault is not used in Slice 49. WorkOS Vault is scoped around WorkOS
organizations, while the current CodeAlmanac product hierarchy does not make
WorkOS organizations own every GitHub account/repository whose user OAuth
token may be stored. Use the local Fernet boundary until the product hierarchy
has an organization-owned secret model.

Legacy plaintext token columns cannot be safely encrypted in SQL because the
Fernet key lives in the backend environment. Launch migrations invalidate and
drop legacy plaintext `oauth_token` / `refresh_token` columns instead of
renaming them to ciphertext. The launch assumption is that there are no real
users to preserve before production rollout.

## Public API

The browser, CLI, capture hooks, and future SDK-like clients need a versioned
API. Use `/v1` for externally callable endpoints.

Implemented Slice 26 auth foundation:

```text
Next.js browser session: WorkOS/AuthKit
Frontend -> FastAPI auth: WorkOS access token bearer auth
FastAPI verification: WorkOS JWKS, `sub` mapped to `workos_user_id`
Hosted user primary key: `workos_user_id text`
Supabase role: database, migrations, storage only
```

This foundation does not yet expose the full public `/v1` API surface, capture
machine credentials, or onboarding configuration screens.

Slice 48 tightened the auth boundary to match WorkOS documentation and the
launch hierarchy rule:

```text
Browser session owner: `@workos-inc/authkit-nextjs`
FastAPI bearer parsing: FastAPI `HTTPBearer(auto_error=False)`
FastAPI access-token verification: WorkOS JWKS URL + PyJWT
Provider gap: WorkOS Python sealed-session helpers are for direct `wos_session`
cookie sessions, not this Next.js-to-FastAPI bearer boundary
```

FastAPI should not parse `Authorization` headers by hand. The only custom code
at this boundary should map WorkOS/AuthKit claims into CodeAlmanac product
identity: WorkOS `sub` becomes `workos_user_id`; missing linked GitHub user
becomes `not_authenticated`; CLI and capture credentials remain separate narrow
product machine credentials.

Implemented Slice 27 CLI auth routes:

```text
POST /v1/auth/cli/start
GET  /v1/auth/cli/sessions/{session_id}
POST /v1/auth/cli/sessions/{session_id}/complete
POST /v1/auth/cli/sessions/{session_id}/poll
GET  /v1/me
POST /v1/auth/logout
```

The older dashboard-compatible routes still exist:

```text
POST /api/cli/auth/sessions
GET  /api/cli/auth/sessions/{session_id}
POST /api/cli/auth/sessions/{session_id}/complete
POST /api/cli/auth/sessions/{session_id}/poll
GET  /api/cli/me
POST /api/cli/logout
```

`/v1/me` and `/v1/auth/logout` authenticate with the hosted CLI token issued by
the poll response. The CLI must never print that token in text or JSON output.

Implemented Slice 28 capture credential routes:

```text
POST /v1/capture/credentials
GET  /v1/capture/status
POST /v1/capture/credentials/revoke
```

Credential issue/status/revoke authenticate with the CLI token. Issue returns
the raw `cap_...` token once. Status returns summaries only and never returns
raw token material. Upload endpoints authenticate with the capture token, not
the human CLI token.

Implemented Slice 47 browser capture status route:

```text
GET /api/capture/status
```

This route authenticates with the WorkOS/AuthKit browser-session bearer token
and returns the same `CaptureStatusDTO` summary as the CLI-token status route.
It exists so the repository setup page can show whether the signed-in user has
issued hosted capture credentials. It never returns raw `cap_...` token
material.

Implemented Slice 29 capture upload routes:

```text
POST /v1/capture/artifacts
POST /v1/capture/turns
```

`POST /v1/capture/artifacts` accepts raw transcript bytes with
`Authorization: Bearer cap_...`, `X-CodeAlmanac-Provider`, and
`X-CodeAlmanac-Provider-Session-Id`. It returns a source-artifact ref and does
not echo transcript text. `POST /v1/capture/turns` accepts normalized routing
metadata plus `artifactRef`. SQL stores refs and metadata, not copied transcript
content.

Implemented Slice 30 internal worker artifact read route:

```text
GET /api/internal/source-artifacts?ref=<source-artifacts-ref>
```

The route authenticates with `X-Internal-Secret`, returns raw artifact bytes,
and includes source ref, sha256, and byte length headers. It is intentionally
not a public `/v1` route. Hosted workers use it to materialize source refs into
worker-local `sources/` folders.

Implemented Slice 28 local capture state:

```text
~/.codealmanac/capture.json mode 0600
~/.codealmanac/capture-events/events.jsonl
```

`capture.json` stores the capture token separately from
`~/.codealmanac/auth.json`. Hook diagnostics are local event records with
upload status. The hidden hook uploads raw transcript artifacts and normalized
turn metadata when transcript evidence is available.

Core endpoints:

```text
GET  /v1/me
POST /v1/auth/cli/start
GET  /v1/auth/cli/sessions/{session_id}
POST /v1/auth/cli/sessions/{session_id}/complete
POST /v1/auth/cli/sessions/{session_id}/poll
POST /v1/auth/logout
POST /v1/capture/credentials
GET  /v1/capture/status
POST /v1/capture/credentials/revoke
POST /v1/capture/artifacts
POST /v1/capture/turns
POST /v1/auth/token/refresh

GET  /api/capture/status
GET  /api/internal/source-artifacts?ref=<source-artifacts-ref>

GET  /v1/repositories
POST /v1/repositories/resolve
GET  /v1/repositories/{repo_id}
GET  /v1/repositories/{repo_id}/branches

GET  /v1/repositories/{repo_id}/triggers
PUT  /v1/repositories/{repo_id}/triggers

GET  /v1/repositories/{repo_id}/runs
POST /v1/repositories/{repo_id}/runs
GET  /v1/runs/{run_id}
GET  /v1/runs/{run_id}/events
POST /v1/runs/{run_id}/cancel
POST /v1/runs/{run_id}/retry

GET  /v1/repositories/{repo_id}/wiki
GET  /v1/repositories/{repo_id}/wiki/pages
GET  /v1/repositories/{repo_id}/wiki/pages/{slug}
GET  /v1/repositories/{repo_id}/wiki/search
```

Browser-only dashboard BFF routes may exist, but they should call this backend
contract or a closely matching service layer.

Slice 36 implemented the CLI-token repository routes used by
`codealmanac repo ...`:

```text
POST /v1/repositories/resolve       # body carries fullName
GET  /v1/repositories/{repo_id}/triggers
PUT  /v1/repositories/{repo_id}/triggers  # body carries branch, enabled, deliveryMode
```

Slice 37 implemented the CLI-token run read routes used by
`codealmanac runs ...`:

```text
GET /v1/repositories/{repo_id}/runs
GET /v1/runs/{run_id}
GET /v1/runs/{run_id}/events
```

Slice 39 implemented the CLI-token manual branch run route used by
`codealmanac runs start --branch <branch>`:

```text
POST /v1/repositories/{repo_id}/runs  # body carries branch
```

Manual branch starts require `Action.APPROVE_UPDATE`. The hosted service reads
the current GitHub branch head, creates a `BranchSource` run, selects delivery
from the branch trigger policy when present, defaults to `commit` otherwise,
and starts the hosted worker. Disabled trigger policy does not block manual
start; trigger `enabled` controls automatic runs only.

Slice 44 implemented the CLI-token cloud run cancellation route used by
`codealmanac runs cancel <run-id>`:

```text
POST /v1/runs/{run_id}/cancel
```

Cancellation requires `Action.APPROVE_UPDATE` on the run's repository. Queued
runs are marked `cancelled` directly. Running runs call Modal through the stored
`worker_call_id`, then become `cancelled`. Delivered, failed, and stale runs
return conflict.

Slice 45 implemented the CLI-token cloud run retry route used by
`codealmanac runs retry <run-id>`:

```text
POST /v1/runs/{run_id}/retry
```

Retry requires `Action.APPROVE_UPDATE` on the original run's repository. It
creates a new run, does not mutate the original terminal run, accepts `failed`,
`stale`, and `cancelled`, rejects `queued`, `running`, and `delivered`, refreshes
the current GitHub head, and preserves captured conversation `source_refs` by
reference.

Slice 38 implemented the browser-session repository resolve route used by
hosted redirectors opened from the CLI:

```text
POST /api/repositories/resolve  # body carries fullName
```

This route uses WorkOS/AuthKit browser session bearer auth, not the stored CLI
token. It resolves the current browser user against the repository service with
`Action.VIEW_REPO` and returns the same `repoId`, `accountId`, `fullName`, and
`defaultBranch` shape as the `/v1` CLI-token route.

Branch names are body fields, not path segments, so slash branches such as
`release/1.4` are preserved.

## Internal API

GitHub webhooks, provider callbacks, and cloud workers need separate internal
auth.

Examples:

```text
POST /internal/github/webhooks
POST /internal/runs/{run_id}/events
POST /internal/runs/{run_id}/complete
GET  /internal/runs/{run_id}/bundle
```

Internal routes authenticate with signed webhook verification, internal service
tokens, or short-lived run tokens. They do not use human CLI tokens.

## Rate Limiting

Rate limits are future work, not a launch blocker for the current product-first
push. Rohan explicitly postponed this work on 2026-07-02 so implementation
should stay focused on hosted setup, auth, repository automation, run delivery,
and verified deployments.

Before broad public scale, public API routes still need abuse limits.

Minimum policy:

```text
auth start/finish: per IP and per device code
token refresh: per refresh token and per IP
capture writes: per machine credential, per user, and per repo
run starts/retries: per repo, per organization, and billing entitlement
wiki reads/search: per IP for anonymous reads if enabled, per actor otherwise
repo resolve/status: per actor and per IP
```

Rate limit responses use:

```text
HTTP 429
Retry-After
error: rate_limited
message: short human-readable message
```

Implementation options:

```text
Vercel/edge middleware for browser-facing burst protection
Redis/Upstash or provider equivalent for shared counters
backend service guard for product-aware limits
Autumn for paid entitlement/runs caps, not raw API abuse limits
```

Do not rely only on frontend throttling.

Current decision: postpone rate-limit implementation. When reopened, prefer a
trusted shared-counter or provider-backed library over custom counting logic,
and keep Autumn for paid entitlement/run caps rather than raw API-abuse limits.

## Authorization Rule

Every API method receives an explicit actor and explicit resource id. Do not
infer organization/repo authority from current working directory, selected CLI
state, or browser route alone.

## Open Implementation Questions

- Exact WorkOS CLI/device auth endpoint shape.
- Exact WorkOS primitive for capture hooks.
- Future broad-scale rate-limit backend provider.
- Exact token storage implementation on macOS/Linux.
