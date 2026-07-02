# Slice 28 Cloud Capture Install Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add explicit cloud capture setup/status/repair/disable commands backed by a narrow hosted capture credential, without using the human CLI token as the long-lived hook token.

**Architecture:** Hosted issues `cap_...` capture credentials from an authenticated CLI session and authenticates capture-only API calls with those credentials. `codealmanac` stores capture credential state separately from cloud login state, installs/removes provider hook config entries, and exposes the public `capture` namespace. Hook commands are lightweight source-capture entrypoints; they must not start wiki update runs.

**Tech Stack:** FastAPI, SQLModel, Pydantic, pytest, Python JSON file adapters, argparse, file-backed local state under `~/.codealmanac/`.

**Status:** Planned on 2026-07-02.

---

## Decisions

- `capture`, not `agents`, is the public noun.
- Capture setup is explicit. `codealmanac setup` may later call it after browser consent, but CLI install must not silently install provider hooks.
- Capture stores a separate narrow credential. The local hook must not use the broad `alm_...` CLI token.
- Capture hooks record source evidence only. They do not trigger a wiki update run.
- Cloud capture and local sync are different postures. Local scheduler-backed sync remains separate from cloud turn capture.
- Provider hook docs are current enough for this slice:
  - Claude Code has `Stop` per turn and `SessionEnd` per session.
  - Codex has `Stop` at turn scope and loads hooks from `~/.codex/hooks.json` or config layers.
  - Codex non-managed hooks may require review/trust through `/hooks`.

## Task 1: Hosted Capture Credential Service

Files:

- Add `backend/src/almanac/services/capture_tokens/`
- Modify `backend/src/almanac/app.py`
- Modify `backend/src/almanac/server/deps.py`
- Add hosted backend tests

Steps:

1. Add `CaptureTokenRow` with `id`, `user_id`, `account_id`, `token_hash`,
   `name`, `created_at`, `last_used_at`, and `revoked_at`.
2. Generate raw tokens with prefix `cap_`.
3. Hash tokens with SHA-256 before storage.
4. Add service methods:
   - `issue(user, name)`
   - `authenticate(raw_token) -> User`
   - `status(user) -> active credential summaries`
   - `revoke_for_user(user, raw_token)`
5. Add `current_capture_user` dependency separate from `current_cli_user`.
6. Keep tables/service separate from `cli_tokens`; do not add a scope flag to
   CLI tokens for this slice.

## Task 2: Hosted `/v1/capture` Credential API

Files:

- Add or modify hosted capture router/DTOs
- Modify router registration if needed
- Add `backend/tests/test_capture_tokens_api_contract.py`

Endpoints:

```text
POST /v1/capture/credentials
GET  /v1/capture/status
POST /v1/capture/credentials/revoke
```

Auth:

```text
credential issue/status/revoke -> CLI token
future upload endpoints        -> capture token
```

Steps:

1. Issue endpoint authenticates with `current_cli_user` and returns raw
   `cap_...` token once.
2. Status endpoint authenticates with `current_cli_user` and returns active
   capture credential summaries, never raw tokens.
3. Revoke endpoint authenticates with `current_cli_user` and revokes the raw
   capture token supplied by the local CLI.
4. Add tests proving CLI token cannot be replaced by capture token on `GET
   /v1/me`, and capture credential status never returns the raw token.

## Task 3: CodeAlmanac Capture State, Client, And Service

Files:

- Add `src/codealmanac/services/cloud_capture/`
- Add HTTP client methods under `src/codealmanac/integrations/cloud/`
- Modify `src/codealmanac/core/models.py`
- Modify `src/codealmanac/core/paths.py`
- Modify `src/codealmanac/app.py`
- Add `tests/test_cloud_capture_service.py`

Steps:

1. Add `AppConfig.capture_path`, defaulting to
   `~/.codealmanac/capture.json`.
2. Store capture state in `capture.json` mode `0600`.
3. Local capture state includes `api_url`, `capture_token`, `created_at`, and
   installed provider names.
4. The service uses cloud auth state to call hosted credential APIs.
5. The service never prints or returns the raw capture token through renderers.
6. Status must distinguish:
   - not signed in
   - no local capture credential
   - local credential present
   - provider hooks installed/missing
   - remote credential active/revoked when checked

## Task 4: Provider Hook Installer

Files:

- Add `src/codealmanac/services/capture_install/`
- Add `src/codealmanac/integrations/capture/`
- Add tests for provider JSON files

Provider files:

```text
Claude: ~/.claude/settings.json
Codex:  ~/.codex/hooks.json
```

Managed command:

```text
codealmanac __capture-hook --provider claude
codealmanac __capture-hook --provider codex
```

Steps:

1. Install a managed command hook on `Stop` for Claude and Codex.
2. Preserve unrelated hooks and settings.
3. Upsert idempotently.
4. Remove only CodeAlmanac-owned hook entries on disable.
5. Surface malformed JSON as a repairable error.
6. For Codex status, mention that the user may need to trust the hook in
   `/hooks`; do not try to bypass Codex trust.
7. Use command hooks that exit quickly and never run model work.

## Task 5: Public Capture CLI

Files:

- Add `src/codealmanac/cli/parser/capture.py`
- Add `src/codealmanac/cli/dispatch/capture.py`
- Add `src/codealmanac/cli/render/capture.py`
- Modify `src/codealmanac/cli/parser/admin.py`
- Modify `src/codealmanac/cli/dispatch/admin.py`
- Modify `tests/test_cli.py`
- Modify `tests/test_public_contract.py`

Commands:

```text
codealmanac capture status [--json] [--check-cloud]
codealmanac capture enable [--target all|codex|claude] [--json]
codealmanac capture repair [--target all|codex|claude] [--json]
codealmanac capture disable [--target all|codex|claude] [--json]
```

Semantics:

- `enable` requires cloud login, issues or reuses a capture credential, and
  installs selected provider hooks.
- `repair` requires cloud login, reissues a credential only when local state is
  missing or remote status says it is revoked, and reinstalls hooks.
- `disable` revokes the stored capture credential when possible and removes
  selected provider hooks.
- `status` is readable without cloud network by default and reports local state.
  `--check-cloud` validates the credential with hosted APIs.

## Task 6: Hidden Hook Entrypoint

Files:

- Add hidden parser/dispatch for `__capture-hook`
- Add tests for stdin parsing and no-op behavior

Steps:

1. Read one provider hook JSON object from stdin.
2. Parse common fields: `session_id`, `transcript_path`, `cwd`, `hook_event_name`,
   and `turn_id` when present.
3. Load `~/.codealmanac/capture.json`.
4. If capture is not enabled, exit 0.
5. Write a small local diagnostic log under `~/.codealmanac/capture-events/`.
6. Do not call the model.
7. Do not upload transcript content in this slice; that is Slice 29.

## Task 7: Docs And Verification

Files:

- Modify `docs/codealmanac-launch/auth-api-contract.md`
- Modify `docs/codealmanac-launch/cli-contract.md`
- Modify `docs/codealmanac-launch/frontend-surface-contract.md`
- Modify `docs/codealmanac-launch/open-questions.md`
- Modify `docs/codealmanac-launch/worklog.md`
- Modify `docs/codealmanac-launch/progress.md`
- Modify `docs/codealmanac-launch/verification-matrix.md`
- Modify `docs/codealmanac-launch/next-agent-brief.md`

Steps:

1. Record exact hosted capture credential endpoints.
2. Record capture credential storage and token secrecy rule.
3. Close the open question about whether `capture enable` can run without full
   onboarding: yes, if the user is signed in and already consented or the cloud
   API allows issuing a capture credential. Browser onboarding still owns first
   consent.
4. Record that Slice 29 should implement transcript parsing and upload through
   the capture token.
5. Send RelayForge after verified commits are pushed.

## Verification Commands

Hosted:

```bash
cd /Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence/backend
uv run pytest tests/test_capture_tokens_api_contract.py tests/test_cli_auth_api_contract.py -q
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

CodeAlmanac:

```bash
cd /Users/rohan/Desktop/Projects/codealmanac
uv run pytest tests/test_cloud_capture_service.py tests/test_cli.py tests/test_public_contract.py tests/test_architecture.py -q
uv run pytest -q
uv run ruff check .
git diff --check
uv run codealmanac capture status --help
uv run codealmanac capture enable --help
uv run codealmanac capture repair --help
uv run codealmanac capture disable --help
```

## Out Of Scope For Slice 28

- Transcript parsing.
- Uploading conversation turn payloads to hosted.
- Selecting branch/session mappings from transcript content.
- Browser UI for capture consent.
- Local lab capture commands.
- Any model run triggered by provider hooks.
