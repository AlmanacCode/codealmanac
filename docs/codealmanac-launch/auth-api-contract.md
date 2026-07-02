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
agent credentials where useful
organization API keys where useful
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
production: https://codealmanac.com/auth/callback
local: http://localhost:3000/auth/callback
```

Configured WorkOS application settings:

```text
redirect URI: https://codealmanac.com/auth/callback
redirect URI: http://localhost:3000/auth/callback
CORS origin: https://codealmanac.com
CORS origin: http://localhost:3000
homepage URL: https://codealmanac.com
```

## CLI Login

`codealmanac login` and the login part of `codealmanac setup` use browser/device
auth.

Flow:

```text
CLI -> POST /v1/auth/cli/start
API -> WorkOS/AuthKit device or CLI auth start
CLI -> opens verification URL and prints fallback code
user -> approves in browser
CLI -> polls POST /v1/auth/cli/finish
API -> returns credential result
CLI -> stores local auth state
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

Stored state:

```text
api_url
user id/email/display
active WorkOS organization id
active GitHub account/repo context only when relevant
access token or credential reference
refresh token only if WorkOS flow requires it
```

## Capture Credentials

Capture hooks should not use an unrestricted human browser token.

After browser consent, the API should mint or return a narrow machine credential
for capture:

```text
scope: capture:write
bound user
bound machine installation
optional bound organization/repo set
revocable from dashboard
```

Use WorkOS' system directly for this if WorkOS provides a suitable primitive.
Do not design a fallback token unless a concrete WorkOS limitation forces it.

## GitHub OAuth Through WorkOS

Enable WorkOS' GitHub OAuth token return setting. In the AuthKit callback,
persist upstream `oauthTokens` from `handleAuth({ onSuccess })` when present.
This replaces the old Supabase callback behavior where `provider_token` and
`provider_refresh_token` were sent to the backend.

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

## Public API

The browser, CLI, capture hooks, and future SDK-like clients need a versioned
API. Use `/v1` for externally callable endpoints.

Core endpoints:

```text
GET  /v1/me
POST /v1/auth/cli/start
POST /v1/auth/cli/finish
POST /v1/auth/token/refresh

GET  /v1/repositories
GET  /v1/repositories/resolve?provider=github&owner=<owner>&repo=<repo>
GET  /v1/repositories/{repo_id}
GET  /v1/repositories/{repo_id}/branches

GET  /v1/repositories/{repo_id}/triggers
PUT  /v1/repositories/{repo_id}/triggers/{branch}
DELETE /v1/repositories/{repo_id}/triggers/{branch}

GET  /v1/repositories/{repo_id}/runs
POST /v1/repositories/{repo_id}/runs
GET  /v1/runs/{run_id}
GET  /v1/runs/{run_id}/events
POST /v1/runs/{run_id}/cancel
POST /v1/runs/{run_id}/retry

POST /v1/capture/sessions
POST /v1/capture/turns
GET  /v1/capture/status

GET  /v1/repositories/{repo_id}/wiki
GET  /v1/repositories/{repo_id}/wiki/pages
GET  /v1/repositories/{repo_id}/wiki/pages/{slug}
GET  /v1/repositories/{repo_id}/wiki/search
```

Browser-only dashboard BFF routes may exist, but they should call this backend
contract or a closely matching service layer.

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

Public API routes need rate limits before launch.

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

Decision: use a low-level shared counter API/backend for launch rate limits.

## Authorization Rule

Every API method receives an explicit actor and explicit resource id. Do not
infer organization/repo authority from current working directory, selected CLI
state, or browser route alone.

## Open Implementation Questions

- Exact WorkOS CLI/device auth endpoint shape.
- Exact WorkOS primitive for capture hooks.
- Exact rate-limit backend provider.
- Exact token storage implementation on macOS/Linux.
