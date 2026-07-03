# Slice 59: CLI Auth Setup Contract

Status: in progress.

## Goal

Make the public CLI setup/auth path match the launch contract:

- `codealmanac setup` is cloud setup.
- The CLI renders first, then asks before opening a browser.
- Non-interactive agent installs print the URL/code and poll without opening a
  browser.
- The auth model is WorkOS CLI Auth through CodeAlmanac product endpoints, not a
  parallel human-token system.
- Root setup does not expose or install local scheduled automation.

## Read Before Coding

- `MANUAL.md`
- `.almanac/README.md`
- `docs/codealmanac-launch/cli-contract.md`
- `docs/codealmanac-launch/auth-api-contract.md`
- `docs/codealmanac-launch/frontend-surface-contract.md`
- `docs/codealmanac-launch/worklog.md`
- `/Users/rohan/Desktop/Projects/openalmanac/mcp/src/setup/tui.ts`
- WorkOS skill references:
  - `workos-authkit-nextjs.md`
  - `workos-python.md`
  - `workos-api-authkit.md`
  - `workos-management.md`

## Current Problem

`CloudLoginWorkflow.run()` opens the browser immediately after
`start_login()`. `SetupService` calls that workflow before any setup renderer can
show the OpenAlmanac-style setup surface. That makes `setup` feel like an abrupt
browser redirect and makes agent-driven installs awkward.

Root `setup` still exposes old local scheduled automation flags. That is stale
local-product residue. Local scheduling belongs under `codealmanac local`, not
cloud setup.

The implemented CLI auth state still uses a single opaque `token` field. The
launch contract says the long-term shape is WorkOS-backed `access_token` and
`refresh_token`. This slice should add the typed seam without breaking the
currently deployed API response.

## Design

The workflow keeps orchestration and token persistence. The CLI/browser decision
becomes a port:

```python
decision = interaction.started(session, request)
if decision.open_browser:
    browser.open(session.verification_url)
poll_until_complete()
```

The default interaction never opens a browser. The CLI interaction prints the
URL/code before polling, asks in interactive terminals, and returns no-open in
non-interactive terminals. This keeps agent installs simple.

Token storage becomes additive:

```text
CloudLoginSession.access_token
CloudLoginSession.refresh_token
CloudAuthState.access_token
CloudAuthState.refresh_token
```

`token` remains a compatibility alias during this slice because the hosted API
may still return `token` until the backend route is updated. The service stores
`access_token` for bearer auth and `refresh_token` when provided.

## Files

Expected CodeAlmanac changes:

- `src/codealmanac/workflows/cloud_login/ports.py`
- `src/codealmanac/workflows/cloud_login/service.py`
- `src/codealmanac/workflows/cloud_login/models.py`
- `src/codealmanac/services/cloud_auth/models.py`
- `src/codealmanac/services/cloud_auth/requests.py`
- `src/codealmanac/services/cloud_auth/service.py`
- `src/codealmanac/services/cloud_auth/store.py`
- `src/codealmanac/integrations/cloud/http.py`
- `src/codealmanac/cli/`
- `src/codealmanac/app.py`
- `tests/test_cli.py`

Expected docs updates:

- `docs/codealmanac-launch/worklog.md`
- `docs/codealmanac-launch/next-agent-brief.md`
- `docs/codealmanac-launch/cli-contract.md`
- `docs/codealmanac-launch/auth-api-contract.md`

## Verification

- Focused CLI setup/login tests.
- Auth store backward-compatibility test for old token-shaped files.
- `uv run pytest` for relevant CLI/cloud auth tests.
- `uv run ruff check .`.
- Fresh `uv tool install --force --refresh codealmanac` smoke after publish if
  the package is released in this slice.
- Hosted API route smoke only after the CLI contract passes locally.

## Out Of Scope

- Reworking GitHub App webhooks.
- Reworking run delivery.
- Replacing current capture `cap_...` credentials with WorkOS API Keys.
- Full hosted frontend redesign.
