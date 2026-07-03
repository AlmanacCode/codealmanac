# Slice 74: GitHub Rate-Limit Provider Errors

## Problem

Production `codealmanac repo status` reaches `POST /v1/repositories/resolve` with a valid CLI token, then fails with a 500. Render ref `ca12707cb1e4` shows GitHub returning HTTP 403 with `API rate limit exceeded` from the collaborator permission endpoint.

## Scope

- Keep WorkOS/AuthKit and CLI login untouched; Chrome verified that flow works.
- Map GitHub rate-limit responses into the provider-unavailable path instead of bad-request/internal-error.
- Make repository permission checks surface `ProviderUnavailable`, not `Forbidden` or raw integration exceptions, when GitHub cannot answer.
- Remove the rate-limited user-token hot path from repo-scoped authorization if live GitHub verifies the App installation token can answer collaborator permissions.
- Add focused backend tests for the mapping and repository service behavior.

## Out of Scope

- Reconciliation, webhook replays, trigger semantics, and dashboard UX polish.
- Adding product rate limits. This slice handles upstream GitHub provider limits only.
- Changing OAuth scopes or WorkOS configuration.

## Design

GitHub uses 403 for some rate-limit failures, so status code alone is not enough. The integration error mapper should inspect the sanitized error message and classify `403/429 + rate limit` as `GitHubUnavailable`. Product services then convert unavailable GitHub calls into `ProviderUnavailable`, which the API already serializes as a 502 error envelope.

Repository permission checks are availability checks, not authorization checks, when GitHub returns a provider failure. A user should see “GitHub permission check is unavailable” rather than “insufficient permission” or a 500.

The first deploy proved that classification alone only changed the failure from 500 to 502. The root hot path still used the user's GitHub OAuth token for `/repos/{owner}/{repo}/collaborators/{username}/permission`, so a rate-limited human token could break every repo-scoped CLI/dashboard call. A live `codealmanac/prd` probe showed the GitHub App installation token can read the same permission for `AlmanacCode/codealmanac` and `rohans0509`, returning `admin`. Repo-scoped authorization should therefore use the repository's installation token.

Account-scoped repo detail should check the local mirrored account id before provider calls, then use repo permission for user authorization. It should not call the user-installations lookup path on every repo detail, trigger, or settings request.

## Verification

- `uv run pytest backend/tests/test_github_errors_contract.py backend/tests/test_repositories_contract.py`
- `uv run pytest backend/tests/test_identity_service_contract.py backend/tests/test_accounts_contract.py`
- Deploy hosted backend.
- Retry:
  - fresh CLI `codealmanac setup` through Chrome
  - `codealmanac whoami`
  - `codealmanac repo status`

Actual final verification:

- `uv run pytest tests/test_repositories_contract.py tests/test_cli_repositories_api_contract.py tests/test_github_errors_contract.py tests/test_accounts_contract.py tests/test_identity_service_contract.py tests/test_api_error_contract.py` (`36 passed, 1 warning`)
- `uv run ruff check src/almanac/services/repositories/service.py tests/test_repositories_contract.py`
- hosted `git diff --check`
- Render deploy `dep-d93s4im7r5hc73c8hh00` live at hosted commit `45b3e05`
- production `codealmanac repo status` passed from a fresh PyPI CLI auth HOME
- production `codealmanac repo triggers list`, `codealmanac capture status --check-cloud --json`, and backend `/api/health` passed
- production `codealmanac repos list` failed as an invalid command; this is a CLI surface gap, not a provider/auth failure
