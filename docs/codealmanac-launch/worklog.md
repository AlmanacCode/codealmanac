# Launch Worklog

## 2026-07-02

- Planned Slice 37 in
  `docs/plans/2026-07-02-slice-37-cloud-runs-cli.md`.
- Added hosted CLI run read routes:
  `GET /v1/repositories/{repo_id}/runs`, `GET /v1/runs/{run_id}`, and
  `GET /v1/runs/{run_id}/events`.
- Added CodeAlmanac `cloud_runs` service, typed cloud run/run-event models,
  HTTP adapter methods, and cloud run workflow.
- Added public cloud run commands:
  `codealmanac runs list`, `codealmanac runs show <run-id>`, and
  `codealmanac runs logs <run-id>`.
- Verified Slice 37 focused hosted backend gate with
  `uv run pytest tests/test_cli_runs_api_contract.py
  tests/test_repositories_api_contract.py tests/test_updates_contract.py -q`
  (`40 passed, 1 warning`).
- Verified Slice 37 focused CodeAlmanac gate with
  `uv run pytest tests/test_cloud_runs_service.py
  tests/test_cloud_runs_workflow.py tests/test_cli.py tests/test_architecture.py -q`
  (`121 passed`).
- Verified Slice 37 CodeAlmanac hygiene with `uv run ruff check .` and
  `uv run python -m compileall src -q`.
- Verified Slice 37 hosted backend hygiene with `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Verified Slice 37 full gates with CodeAlmanac `uv run pytest -q`
  (`490 passed`) and hosted backend `uv run pytest -q`
  (`326 passed, 1 warning`).
- Pushed hosted commit `168f9b2 feat: add CLI run read routes` to
  `origin/codex/workos-authkit-api-foundation`.
- Pushed CodeAlmanac commit `bc177cf2 feat: inspect cloud runs from CLI` to
  `origin/dev`.
- Sent the Slice 37 RelayForge update with progress as:
  CodeAlmanac backend/local 94%, CLI/public UX 78%,
  CodeAlmanac-hosted backend/auth/API 80%, hosted frontend/onboarding 28%, and
  infra/deploy rename 15%.
- Planned Slice 36 in
  `docs/plans/2026-07-02-slice-36-cloud-repo-trigger-cli.md`.
- Added hosted CLI repository routes:
  `POST /v1/repositories/resolve`,
  `GET /v1/repositories/{repo_id}/triggers`, and
  `PUT /v1/repositories/{repo_id}/triggers`.
- Added direct repo-id trigger policy service methods for CLI-token routes.
  Browser routes remain account-scoped.
- Added CodeAlmanac `cloud_repositories` service, typed cloud repository
  models, HTTP adapter methods, and current-checkout cloud repo workflow.
- Added public cloud repo commands:
  `codealmanac repo status`,
  `codealmanac repo triggers list`,
  `codealmanac repo triggers enable <branch> --delivery pr|commit`,
  `codealmanac repo triggers disable <branch>`, and
  `codealmanac repo delivery set --branch <branch> --mode pr|commit`.
- Verified Slice 36 focused hosted backend gate with
  `uv run pytest tests/test_cli_repositories_api_contract.py
  tests/test_repositories_api_contract.py tests/test_repositories_contract.py -q`
  (`23 passed, 1 warning`).
- Verified Slice 36 focused CodeAlmanac gate with
  `uv run pytest tests/test_cloud_repositories_service.py
  tests/test_cloud_repo_workflow.py tests/test_cli.py -q` (`57 passed`).
- Verified Slice 36 CodeAlmanac hygiene/full gates with
  `uv run ruff check .`, touched-file `uv run ruff format --check ...`,
  `uv run python -m compileall src -q`, `uv run pytest -q`
  (`487 passed`), and `git diff --check`.
- Verified Slice 36 hosted backend hygiene/full gates with
  `uv run ruff check .`, touched-file `uv run ruff format --check ...`,
  `uv run python -m compileall src modal_app -q`, `uv run pytest -q`
  (`324 passed, 1 warning`), and `git diff --check`.
- Pushed hosted commit
  `fbf8b5a feat: add CLI repository trigger routes` to
  `origin/codex/workos-authkit-api-foundation`.
- Pushed CodeAlmanac commit
  `8ca50e0f feat: mirror cloud repository triggers in CLI` to `origin/dev`.
- Sent the Slice 36 RelayForge update with progress as:
  CodeAlmanac backend/local 93%, CLI/public UX 72%,
  CodeAlmanac-hosted backend/auth/API 78%, hosted frontend/onboarding 28%, and
  infra/deploy rename 15%.
- Planned Slice 35 in
  `docs/plans/2026-07-02-slice-35-hosted-trigger-policies.md`.
- Added hosted `repository_trigger_policies`, keyed by `(repo_id, branch)`,
  with `enabled` and cloud delivery mode `commit|pr`.
- Added backend `RepositoryTriggerPolicy` models, table/store/service methods,
  API DTOs, and account-scoped routes:
  `GET /api/accounts/{account_id}/repositories/{repo_id}/triggers` and
  `PUT /api/accounts/{account_id}/repositories/{repo_id}/triggers`.
- Added branch-push update planning from normalized GitHub `BranchPushed`
  events. A branch push starts an update only when the branch has an enabled
  trigger policy.
- Added deterministic policy-based branch delivery:
  `commit` creates `CommitToBranch`; `pr` creates `OpenWikiPullRequest`.
- Added the repository settings branch trigger UI. It reads real GitHub branch
  DTOs, shows saved trigger policies, lets users toggle maintained branches,
  and chooses commit vs PR delivery per branch.
- Fixed the Atlas design-lab mock status metadata to include `stale`, which was
  required for production TypeScript build after Slice 33.
- Verified Slice 35 focused backend gate with
  `uv run pytest tests/test_repositories_contract.py
  tests/test_repositories_api_contract.py tests/test_updates_contract.py
  tests/test_architecture_contract.py -q` (`118 passed, 1 warning`).
- Verified Slice 35 hosted frontend gates with `npm run test:frontend`
  (`44 passed`), `npm run test:routes` (`26 passed`), `npm run lint`, and
  `npm run build`. Build passed with the known CSS optimizer warning about
  `m-* utility`.
- Verified Slice 35 hosted backend hygiene/full gates with
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `uv run pytest -q`
  (`320 passed, 1 warning`), and `git diff --check`.
- Pushed hosted commit
  `1b00b63 feat: add repository trigger policies` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 34 in
  `docs/plans/2026-07-02-slice-34-hosted-run-event-visibility.md`.
- Added hosted `RunEventDTO` and
  `GET /api/runs/{run_id}/events`.
- Added `Updates.run_events_for_user(...)` and
  `UpdateQueries.run_events_for_user(...)`, authorizing access through the
  run's repository before returning ordered events.
- Added frontend `RunEventDTO` parity, `listRunEvents(runId)`, and the
  BFF allowlist path `GET /api/dashboard/runs/<uuid>/events`.
- Added lazy dashboard run-event loading through an expandable `RunRow`
  timeline that renders event kind, relative time, message, and normalized
  payload fields.
- Verified Slice 34 focused hosted backend gate with
  `uv run pytest tests/test_updates_contract.py
  tests/test_repositories_api_contract.py tests/test_update_run_events_contract.py -q`
  (`35 passed, 1 warning`).
- Verified Slice 34 hosted frontend gates with `npm run test:frontend`
  (`43 passed`), `npm run test:routes` (`26 passed`), and `npm run lint`.
- Verified Slice 34 hosted hygiene/full backend gates with
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `uv run pytest -q`
  (`312 passed, 1 warning`), and `git diff --check`.
- Pushed hosted commit
  `4e4c94b feat: expose run event timeline` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 33 in
  `docs/plans/2026-07-02-slice-33-hosted-delivery-stale-outcome.md`.
- Added hosted `RunStatus.STALE` and `UpdateResult.stale(...)` for runs whose
  target branch moved before delivery.
- Replaced raw GitHub commit-head drift `ValueError` with typed
  `GitHubBranchHeadChanged`.
- Added product-level `StaleDelivery` in hosted delivery, with preflight branch
  head checks for `CommitToBranch` and `OpenWikiPullRequest`, while keeping the
  commit-time expected-head check as defense in depth.
- Added `UpdatesStore.mark_stale(...)`, storing terminal stale run state,
  stale reason, finished timestamp, and a `run_events` status payload with
  expected and actual head SHAs.
- Made completion catch stale delivery, skip billing and `RunDelivered`
  dispatch, and clear conversation ingest state with a stale status.
- Added backend/API/frontend status parity for `stale`, including run DTOs,
  conversation source summaries, frontend DTOs, status labels, and status icon
  rendering.
- Verified Slice 33 focused hosted backend gate with
  `uv run pytest tests/test_updates_contract.py
  tests/test_update_run_events_contract.py tests/test_github_git_contract.py
  tests/test_repositories_api_contract.py -q` (`38 passed, 1 warning`).
- Verified Slice 33 frontend status gates with `npm run test:frontend`
  (`41 passed`) and `npm run test:routes` (`26 passed`).
- Verified Slice 33 hosted hygiene/full backend gates with
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `git diff --check`, `npm run lint`,
  and `uv run pytest -q` (`311 passed, 1 warning`).
- Pushed hosted commit
  `9098b65 feat: record stale delivery outcomes` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 32 in
  `docs/plans/2026-07-02-slice-32-hosted-run-events.md`.
- Added hosted SQL-backed `run_events` with ordered `(run_id, sequence)`
  storage, event kind, message, timestamp, and optional normalized
  `payload_json`.
- Added hosted `RunEventKind` and `RunEvent` models, `RunEventRow`, and
  `run_event_from_row`.
- Wired `UpdatesStore` transitions to append lifecycle status events for
  queued, running, delivered, and failed runs in the same transaction as the
  run status update.
- Kept event payloads limited to metadata such as `worker_call_id`,
  `commit_sha`, `files_changed`, `summary`, and `error`; source and model
  transcript bodies still stay out of run events.
- Added `run_events` to the launch Supabase init migration.
- Verified Slice 32 focused hosted gate with
  `uv run pytest tests/test_update_run_events_contract.py tests/test_updates_contract.py tests/test_architecture_contract.py -q`
  (`93 passed`), `uv run ruff check .`, `uv run ruff format --check .`, and
  `git diff --check`.
- Verified hosted compile/full backend gates with
  `python -m compileall backend/src backend/modal_app -q` and
  `uv run pytest -q` (`306 passed, 1 warning`).
- Pushed hosted commit
  `12cfc08 feat: persist hosted run events` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 31 in
  `docs/plans/2026-07-02-slice-31-hosted-direct-maintenance-api.md`.
- Added `codealmanac.maintenance` as the package API for non-CLI callers.
  It routes typed `init` and `ingest` maintenance requests into the existing
  CodeAlmanac workflows and returns run id, run status, harness status,
  summary, and output text.
- Verified the local maintenance API with
  `uv run pytest tests/test_maintenance_api.py tests/test_public_contract.py tests/test_architecture.py -q`
  (`91 passed`), `uv run ruff check .`, and `git diff --check`.
- Verified the full CodeAlmanac suite with `uv run pytest -q`
  (`484 passed`).
- Pushed CodeAlmanac commit
  `f20e928d feat: expose maintenance package api` to `origin/dev`.
- Replaced the hosted Modal worker's public-CLI subprocess bridge with
  `backend/modal_app/codealmanac_engine.py`, which maps hosted
  `PullRequestSource`, `ConversationBatchSource`, and `BranchSource` runs to
  `codealmanac.maintenance` requests.
- Deleted the hosted `backend/src/almanac/services/updates/codealmanac.py`
  command builder. The production update worker no longer imports
  `modal_app.commands`, `run_command`, or `codealmanac_command`.
- Updated the hosted Modal image `CODEALMANAC_GIT_REF` to
  `f20e928d5a62a1bb8b45ad670b90eac000011444`.
- Verified the hosted focused gate with
  `uv run pytest tests/test_modal_worker_contract.py tests/test_architecture_contract.py -q`
  (`81 passed`), `uv run ruff check .`, `uv run ruff format --check .`, and
  `git diff --check`.
- Verified hosted compile/full backend gates with
  `python -m compileall backend/src backend/modal_app -q` and
  `uv run pytest -q` (`303 passed, 1 warning`).
- Pushed hosted commit
  `51c2cb2 feat: call codealmanac maintenance api` to
  `origin/codex/workos-authkit-api-foundation`.
- Planned Slice 30 in
  `docs/plans/2026-07-02-slice-30-cloud-source-bundle-materialization.md`.
- Changed hosted conversation-batch update runs to store source artifact refs,
  not rendered conversation text, in `ConversationBatchSource`.
- Added hosted source-artifact reads through the service/store port and
  protected internal route:
  `GET /api/internal/source-artifacts?ref=...`.
- Changed the hosted conversation ingest scheduler to select only captured
  turns with non-null `source_ref` values and to schedule ingest when capture
  uploads a completed routable turn with a source ref.
- Added Modal worker source materialization:
  `.codealmanac-worker/sources/<batch-id>/manifest.json` plus
  `sessions/<provider>/<provider-session-id>-<hash>.jsonl`.
- Updated hosted worker command construction to use the current Python
  CodeAlmanac maintenance surfaces:
  `codealmanac dev ingest <sources-dir> --foreground --using codex`,
  `codealmanac dev ingest github:pr:<n> --foreground --using codex`, and
  `codealmanac init --using codex --yes`.
- Changed the Modal image to install Python CodeAlmanac from a pinned git ref
  instead of installing the old npm `codealmanac@latest` package.
- Kept the hosted worker on a process bridge for this slice. The next worker
  slice should replace the process command with a direct Python engine/model API
  call.
- Verified Slice 30 focused hosted backend gates with
  `uv run pytest tests/test_conversation_ingest_scheduler.py
  tests/test_capture_upload_api_contract.py tests/test_internal_route_contract.py
  tests/test_modal_worker_contract.py tests/test_updates_contract.py
  tests/test_architecture_contract.py -q` (`119 passed, 1 warning`).
- Verified Slice 30 full hosted backend with `uv run pytest -q`
  (`301 passed, 1 warning`).
- Verified Slice 30 hosted lint/format/diff gates with `uv run ruff check .`,
  `uv run ruff format --check .`, and `git diff --check`.
- Planned Slice 29 in
  `docs/plans/2026-07-02-slice-29-capture-transcript-upload.md`.
- Added hosted source-artifact service seam with a filesystem-backed
  development store and `source-artifacts://...` refs.
- Added hosted capture upload routes:
  `POST /v1/capture/artifacts` and `POST /v1/capture/turns`.
- Added `conversation_sources.source_ref` and migration
  `20260702000000_conversation_source_refs.sql`.
- Added local transcript normalization for Codex and Claude hook payloads,
  including deterministic fallback turn IDs.
- Extended `codealmanac __capture-hook --provider codex|claude` to upload raw
  transcript artifacts with the stored `cap_...` credential, then upload
  normalized turn metadata with `artifactRef`.
- Kept the old inline-message conversation ingest scheduler unchanged. The
  capture-token path stores refs and metadata but does not enqueue empty
  message-based ingest runs in this slice.
- Verified Slice 29 focused hosted backend gates with
  `uv run pytest tests/test_capture_tokens_api_contract.py
  tests/test_capture_upload_api_contract.py
  tests/test_hosted_conversation_sync_contract.py
  tests/test_conversation_ingest_scheduler.py
  tests/test_architecture_contract.py -q` (`88 passed, 1 warning`) and
  `uv run ruff check .`.
- Verified Slice 29 focused local gates with
  `uv run pytest tests/test_capture_transcript_upload.py
  tests/test_cloud_capture_service.py tests/test_cli.py tests/test_public_contract.py
  tests/test_architecture.py -q` (`147 passed`) and `uv run ruff check .`.
- Planned Slice 28 in
  `docs/plans/2026-07-02-slice-28-cloud-capture-install.md`.
- Added hosted `capture_tokens` service/store/table boundary and `/v1`
  capture credential routes:
  `POST /v1/capture/credentials`, `GET /v1/capture/status`, and
  `POST /v1/capture/credentials/revoke`.
- Added hosted `cap_...` capture tokens hashed at rest and separated from
  `alm_...` CLI tokens. Issue/status/revoke use the CLI token; future upload
  endpoints use the capture token.
- Pushed hosted commit `36211ba feat: add capture credential API` to
  `origin/codex/workos-authkit-api-foundation`.
- Added matching frontend capture DTO declarations so hosted backend/frontend
  DTO names and fields stay mirrored.
- Added local `~/.codealmanac/capture.json` mode `0600` and
  `~/.codealmanac/capture-events/events.jsonl` diagnostic event storage.
- Added public cloud capture commands:
  `codealmanac capture status`, `codealmanac capture enable`,
  `codealmanac capture repair`, and `codealmanac capture disable`.
- Added hidden hook entrypoint
  `codealmanac __capture-hook --provider codex|claude`.
- Added Codex and Claude Stop hook installation/removal under
  `~/.codex/hooks.json` and `~/.claude/settings.json`, preserving unrelated
  provider settings.
- Kept transcript parsing/upload and model runs out of Slice 28. Hooks only
  record local diagnostic events until Slice 29.
- Verified Slice 28 hosted backend with `uv run pytest -q` (`291 passed, 1
  warning`), `uv run ruff check .`, and `uv run ruff format --check .`.
- Verified Slice 28 hosted frontend with `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), and `npm run build`.
- `npm run build` still emits the known non-blocking CSS optimizer warning
  about a comment containing `m-* utility`.
- Verified Slice 28 `codealmanac` with `uv run pytest -q` (`477 passed`),
  `uv run ruff check .`, `git diff --check`, and help checks for
  `capture status`, `capture enable`, `capture repair`, and
  `capture disable`.
- Planned Slice 27 in
  `docs/plans/2026-07-02-slice-27-cloud-cli-auth.md`.
- Added hosted `/v1` CLI auth aliases over the existing CLI token service:
  `/v1/auth/cli/start`, `/v1/auth/cli/sessions/{session_id}`,
  `/v1/auth/cli/sessions/{session_id}/complete`,
  `/v1/auth/cli/sessions/{session_id}/poll`, `/v1/me`, and
  `/v1/auth/logout`.
- Added `codealmanac` cloud auth state, typed HTTP client, token store,
  browser opener port, and browser login workflow.
- Added public cloud identity commands:
  `codealmanac login`, `codealmanac whoami`, and `codealmanac logout`.
- Made `codealmanac setup` cloud-first and not repo-scoped; local-only setup
  remains under `codealmanac local setup`.
- Stored only the issued hosted CLI token in `~/.codealmanac/auth.json` with
  mode `0600`; WorkOS browser tokens are not stored by the local CLI.
- Verified Slice 27 hosted backend with `uv run pytest -q` (`289 passed`),
  `uv run ruff check .`, and `uv run ruff format --check .`.
- Verified Slice 27 `codealmanac` with `uv run pytest -q` (`474 passed`),
  `uv run ruff check .`, `git diff --check`, and help checks for
  `login`, `setup`, `whoami`, and `logout`.
- Created launch plan at
  `docs/plans/2026-07-02-codealmanac-cloud-local-launch.md`.
- Added CLI/onboarding launch note at
  `docs/hosted-local-live-agreement/cli-onboarding-launch-2026-07-02.md`.
- Recorded that launch is not an MVP/V1 shortcut plan.
- Recorded that `usealmanac` will become `codealmanac-hosted`.
- Recorded that the public CLI is not the worker API.
- Recorded that CLI auto-update should research existing libraries before
  custom implementation.
- Created `docs/codealmanac-launch/` as the steering folder for decisions,
  ownership, open questions, verification, and worklog.
- Added `deployment-rename-runbook.md` with GitHub, Vercel, Render, Modal,
  Supabase, Doppler, PostHog, and Autumn rename/deploy steps.
- Recorded that provider CLIs/APIs should be used where available.
- Recorded that Supabase migrations can be rewritten/collapsed/repaired because
  there are no external customers yet.
- Added `overnight-run-contract.md` to make infrastructure/deployment the first
  execution priority before deep product implementation.
- Checked local provider CLI availability: `gh`, `vercel`, `render`,
  `supabase`, `modal`, and `doppler` are present on PATH.
- Verified `atmn` works through `/Users/rohan/Desktop/Projects/usealmanac/frontend`
  with `npm exec -- atmn --version`.
- Verified official PostHog CLI help works through
  `npm exec --package @posthog/cli -- posthog-cli --help`; version command hit
  local spawn error `Unknown system error -88`.
- Added `schema-contract.md` as the single launch contract for local/cloud
  tables, run storage, source artifacts, run artifacts, and cloud-only tables.
- Audited session `019f1be2-83a2-7c03-bf18-f5adc681857d` against the launch
  folder.
- Added `cli-contract.md`, `frontend-surface-contract.md`, and
  `repo-organization.md` to close launch-folder coverage gaps found by the
  audit.
- Copied curated WorkOS research notes from `../almanac/docs/workos/` into
  `docs/codealmanac-launch/references/workos/`.
- Checked WorkOS local setup: `workos` CLI is not installed on PATH.
- Verified WorkOS CLI can run through
  `WORKOS_MODE=agent npx -y workos --help --json`.
- Checked Doppler secret names: `codealmanac` has no WorkOS secret names in
  `dev` or `prd`; older `almanac` has WorkOS secret names in `dev` and `prd`.
- Added `auth-api-contract.md` covering WorkOS/AuthKit, CLI login/token
  storage, capture credentials, public API, internal API, and rate limits.
- Confirmed callback targets:
  `https://codealmanac.com/auth/callback` and
  `http://localhost:3000/auth/callback`.
- Recorded that `codealmanac-hosted` is a rename/evolution of `usealmanac`, and
  the current frontend look and feel should be preserved while internals can be
  refactored.
- Recorded delivery defaults: cloud commit, local commit.
- Recorded worker/package defaults: hosted pins `codealmanac` by git SHA and
  workers call the engine/model API directly rather than the human CLI.
- Recorded that the WorkOS project is `codealmanac`.
- Recorded the source/engine rule: intelligence lives in prompts, and sources
  are passed by reference rather than value.
- Recorded the WorkOS environment rule: use one production environment for now,
  with no dev/staging/prod WorkOS split.
- Recorded the WorkOS GitHub OAuth decision: return provider OAuth tokens, keep
  the default OAuth scope at `user:email`, and use GitHub App installation
  tokens for repository work.
- Stored the new WorkOS `codealmanac` project credentials in Doppler configs
  `dev`, `dev_personal`, `stg`, and `prd` without recording secret values.
- Configured WorkOS redirects, CORS origins, and homepage URL for
  `codealmanac.com` and local `localhost:3000`.
- Removed stale copied `WORKOS_ISSUER` from the CodeAlmanac Doppler configs.
- Probed `codealmanac/prd` GitHub access for `rohans0509`: refreshed the stored
  GitHub App user token, confirmed empty OAuth scopes, listed visible app
  installations, listed installation repositories, checked org role, and checked
  repo permission.
- Copied the init first-build and prompt-restoration plan into the launch
  steering folder as the first local/Python prerequisite for the hosted worker
  path.
- Stopped Browser Use cloud login setup at user request. Browser automation for
  this launch uses the already-working local browser harness / Codex browser,
  not Browser Use cloud auth.
- Renamed the GitHub repository from `AlmanacCode/usealmanac` to
  `AlmanacCode/codealmanac-hosted` and updated the local `usealmanac` origin to
  `https://github.com/AlmanacCode/codealmanac-hosted.git`.
- Updated local hosted repo deploy/package names for the rename:
  `.github/workflows/deploy.yml`, `backend/modal_app/runtime.py`,
  `backend/src/almanac/settings.py`, `backend/pyproject.toml`,
  `backend/uv.lock`, `frontend/package.json`, `frontend/package-lock.json`, and
  local Vercel project metadata now point at `codealmanac-hosted` names.
- Verified the targeted Modal worker contract test passes:
  `cd ../usealmanac/backend && uv run pytest tests/test_modal_worker_contract.py`.
- Deployed Modal app `codealmanac-hosted-updates` in environment `main` with:
  `cd ../usealmanac/backend && PYTHONPATH=src uv run modal deploy modal_app/updates_worker.py --env main`.
- Verified Render service `codealmanac-backend` already points to
  `https://github.com/AlmanacCode/codealmanac-hosted` on branch `main`.
- Verified Vercel project `thealmanac/usealmanac` still has provider project
  name `usealmanac` while serving production URL `https://www.codealmanac.com`.
  The installed Vercel CLI exposes project list/inspect/add/remove/token but no
  project rename command.
- Repaired a frontend design-lab mock DTO that was missing
  `localAgentSetupIntroSeenAt`, which blocked `npm run build`.
- Verified the frontend builds with `cd ../usealmanac/frontend && npm run build`.
- Deployed the frontend to Vercel production with
  `cd ../usealmanac/frontend && vercel deploy --prod --scope thealmanac`.
  Vercel aliased the deployment to `https://www.codealmanac.com`.
- Verified `https://www.codealmanac.com` returns HTTP 200 and
  `https://codealmanac-backend-docker.onrender.com/api/health` returns
  `{"status":"ok"}`.
- Set `MODAL_APP_NAME=codealmanac-hosted-updates` in Doppler project
  `codealmanac`, config `prd`.
- Triggered Render deploy `dep-d930nheh2hms73d259s0` for service
  `codealmanac-backend`; it became live and `/api/health` returned
  `{"status":"ok"}` after deployment.
- Planned Slice 1 in
  `docs/plans/2026-07-02-slice-1-local-control-db.md`.
- Added the local control DB foundation in `codealmanac`:
  `~/.codealmanac/control.sqlite`, `AppConfig.control_db_path`,
  `app.control`, and `src/codealmanac/services/control/`.
- Added the launch control tables locally: `repositories`, `branches`,
  `sessions`, `turns`, `turn_branches`, `trigger_events`, `runs`,
  `run_events`, and `deliveries`.
- Verified Slice 1 with
  `uv run pytest tests/test_control_service.py tests/test_database.py tests/test_architecture.py`
  and `git diff --check`.
- Planned Slice 2 in
  `docs/plans/2026-07-02-slice-2-local-trigger-events.md`.
- Added writable local control service verbs for repository upsert, branch
  trigger policy, trigger event recording, and trigger event listing.
- Implemented branch filtering for local triggers: disabled or unknown branches
  do not write `trigger_events` rows.
- Implemented pending-trigger supersession: when a newer head is recorded for a
  branch, older pending trigger events for that branch become `superseded`.
- Verified Slice 2 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py` and
  `git diff --check`.
- Planned Slice 3 in
  `docs/plans/2026-07-02-slice-3-local-trigger-dispatch.md`.
- Added the hidden local hook dispatcher
  `codealmanac __record-local-trigger`.
- Added a `LocalGitStateProbe` port and concrete Git probe that reads
  repository root, current branch, and HEAD SHA.
- Wired the Git probe through `create_app()` into `ControlService`; CLI dispatch
  still does not import Git integrations.
- Verified Slice 3 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_git_workspace_probe.py tests/test_cli.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Planned Slice 4 in
  `docs/plans/2026-07-02-slice-4-local-git-hooks.md`.
- Added `app.local_hooks` with install/uninstall service methods.
- Added the Git hook file adapter for `post-commit`, `post-merge`, and
  `post-rewrite`.
- Hook blocks call `codealmanac __record-local-trigger`, preserve existing user
  hook content, redirect output, and end with `|| true`.
- Verified Slice 4 focused behavior with
  `uv run pytest tests/test_local_hooks.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Planned Slice 5 in
  `docs/plans/2026-07-02-slice-5-control-run-ledger.md`.
- Added SQL-backed control run methods:
  `create_run`, `update_run`, `append_run_event`, and `list_run_events`.
- Added launch run statuses and run event kinds to the control service models.
- Verified Slice 5 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Planned Slice 6 in
  `docs/plans/2026-07-02-slice-6-trigger-claim-run-handoff.md`.
- Added `app.control.claim_next_trigger` to atomically claim pending trigger
  events and create queued control run rows.
- Verified Slice 6 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py`,
  `uv run ruff check .`, and `git diff --check`.
- Sent the first RelayForge progress update through:
  `doppler run --project almanac --config dev -- relayforge reply --config /Users/rohan/Desktop/Projects/relayforge/relay.config.json --binding rohan-almanac-main`.
- Recorded launch progress percentages in `docs/codealmanac-launch/progress.md`.
- Planned Slice 7 in
  `docs/plans/2026-07-02-slice-7-engine-run-artifacts.md`.
- Added `app.engine_runs` with file-backed shared engine request/result
  artifacts under `~/.codealmanac/runs/<run-id>/`.
- Added `EngineRunRequest`, `EngineRunResult`, typed changed-file records, and
  commit subject validation for the `docs almanac:` style.
- Verified Slice 7 focused behavior with
  `uv run pytest tests/test_engine_runs_service.py tests/test_architecture.py`.
- Verified Slice 7 full gate with `uv run pytest` (`383 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 7 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 38%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 8 in
  `docs/plans/2026-07-02-slice-8-worker-workspaces.md`.
- Added `app.worker_workspaces` with a local worker workspace layout under
  `~/.codealmanac/workspaces/<run-id>/`.
- Added `src/codealmanac/services/worker_workspaces/` with typed paths,
  request objects, a Git worktree port, filesystem store, and service verbs.
- Added `GitDetachedWorktreeManager`, which creates detached worktrees at the
  expected head SHA using `git worktree add --detach`.
- Verified Slice 8 focused behavior with
  `uv run pytest tests/test_worker_workspaces_service.py tests/test_architecture.py`.
- Verified Slice 8 full gate with `uv run pytest` (`389 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 8 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 42%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 9 in
  `docs/plans/2026-07-02-slice-9-local-run-preparation.md`.
- Added control read seams for repositories and branches.
- Extended control run updates to store `source_bundle_ref` and `request_ref`.
- Added `app.workflows.local_runs.prepare_next(...)`, which claims a pending
  trigger, prepares a local worker workspace, creates an engine request
  artifact, stores refs on the control run, and appends a run event.
- Added failure handling for claimed runs that cannot be prepared.
- Verified Slice 9 focused behavior with
  `uv run pytest tests/test_local_run_preparation_workflow.py tests/test_control_service.py tests/test_architecture.py`.
- Verified Slice 9 full gate with `uv run pytest` (`393 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 9 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 47%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 10 in
  `docs/plans/2026-07-02-slice-10-branch-head-staling.md`.
- Added `app.control.get_run(...)`.
- Added branch-head staling inside trigger recording: newer configured
  triggers mark queued/running runs for older expected heads as `stale`.
- Added normalized status run events for stale runs.
- Removed unused `EnsureControlSchemaRequest`.
- Verified Slice 10 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_architecture.py`.
- Verified Slice 10 full gate with `uv run pytest` (`394 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 10 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 50%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 11 in
  `docs/plans/2026-07-02-slice-11-source-bundle-materialization.md`.
- Added control DB verbs for sessions, turns, turn-branch links, and distinct
  branch session selection.
- Added `app.source_bundles` with a manifest-backed local source bundle
  materializer.
- Wired local run preparation to materialize `sources/manifest.json` and copied
  session files before writing the engine request.
- Added architecture guards for the source-bundle service boundary.
- Corrected the launch plan commit-subject example to `docs almanac:`.
- Verified Slice 11 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_source_bundles_service.py tests/test_local_run_preparation_workflow.py tests/test_architecture.py`.
- Verified Slice 11 full gate with `uv run pytest` (`398 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 11 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 53%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 12 in
  `docs/plans/2026-07-02-slice-12-deterministic-local-delivery.md`.
- Added `app.deliveries` over the existing control DB `deliveries` table.
- Added `app.workflows.local_delivery.deliver(...)`.
- Added `GitLocalDeliveryManager` for expected-head reads, wiki-only patch
  collection, patch application, and `docs almanac:` commit delivery.
- Added worker workspace path lookup by run id.
- Verified moved-head behavior: delivery is skipped and the run is marked
  `stale`.
- Verified empty worker diffs skip delivery and mark the run `succeeded`.
- Verified Slice 12 focused behavior with
  `uv run pytest tests/test_deliveries_service.py tests/test_local_delivery_workflow.py tests/test_git_local_delivery.py tests/test_worker_workspaces_service.py tests/test_architecture.py`.
- Verified Slice 12 full gate with `uv run pytest` (`407 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 12 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 58%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 13 in
  `docs/plans/2026-07-02-slice-13-local-engine-execution.md`.
- Added `app.workflows.local_engine.execute(...)`.
- Added `src/codealmanac/workflows/local_engine/` with request/result models,
  update prompt rendering, deterministic result helpers, and run-event
  recording helpers.
- Added `src/codealmanac/prompts/operations/update.md`.
- Wired local engine execution through the existing harness seam:
  `RunHarnessRequest(kind, cwd, prompt, title)`.
- The local engine now reads prepared `request.json`, runs the model in the
  worker repo, writes `result.json`, stores `result_ref`, and leaves delivery
  to `app.workflows.local_delivery`.
- Verified Slice 13 focused behavior with
  `uv run pytest tests/test_local_engine_workflow.py tests/test_engine_runs_service.py tests/test_architecture.py`.
- Verified Slice 13 full gate with `uv run pytest` (`411 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 13 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 63%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 14 in
  `docs/plans/2026-07-02-slice-14-local-worker-orchestration.md`.
- Added `app.workflows.local_worker.run_next(...)`.
- Added `src/codealmanac/workflows/local_worker/` with typed request/result
  models and orchestration over local preparation, engine execution, and local
  delivery.
- The worker returns a no-op when no pending trigger exists, returns a processed
  failed result for preparation or engine failure, and skips delivery if a run
  becomes `stale` while the engine is running.
- Verified Slice 14 focused behavior with
  `uv run pytest tests/test_local_worker_workflow.py tests/test_local_run_preparation_workflow.py tests/test_local_engine_workflow.py tests/test_local_delivery_workflow.py tests/test_architecture.py`.
- Verified Slice 14 full gate with `uv run pytest` (`417 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 14 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 67%, CLI/public UX 10%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 15 in
  `docs/plans/2026-07-02-slice-15-hidden-local-worker-cli.md`.
- Added hidden CLI command `codealmanac __run-local-worker`.
- The hidden command calls `app.workflows.local_worker.run_next(...)`, can
  filter by `repository_id` and `branch_id`, accepts `--using`, and emits the
  typed workflow result with `--json`.
- Default command output stays quiet so a future hook or background spawner can
  call it without noisy terminal output.
- Verified Slice 15 focused behavior with
  `uv run pytest tests/test_cli.py tests/test_local_worker_workflow.py tests/test_architecture.py`.
- Verified Slice 15 full gate with `uv run pytest` (`419 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 15 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 68%, CLI/public UX 12%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 16 in
  `docs/plans/2026-07-02-slice-16-local-hook-worker-spawn.md`.
- Added `SpawnLocalWorkerRequest` and a `LocalWorkerSpawner` port.
- Added `SubprocessLocalWorkerSpawner`, which starts
  `codealmanac __run-local-worker` in a detached process for a specific
  repository and branch.
- Added `codealmanac __record-local-trigger --spawn-worker`.
- Updated installed local Git hook blocks to record triggers and request a
  detached local worker spawn.
- The hook path still records triggers synchronously and does not run the model
  worker inline.
- Verified Slice 16 focused behavior with
  `uv run pytest tests/test_cli.py tests/test_local_hooks.py tests/test_local_worker_spawner.py tests/test_architecture.py`.
- Verified Slice 16 full gate with `uv run pytest` (`422 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 16 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 72%, CLI/public UX 13%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 17 in
  `docs/plans/2026-07-02-slice-17-local-setup-command.md`.
- Added `app.workflows.local_setup.setup(...)`.
- Added `GitLocalRepositoryProbe`, which reads the current Git checkout,
  current branch, HEAD SHA, and GitHub `origin` identity.
- Added public `codealmanac local setup` with `--branch`, `--delivery
  commit|working-tree`, `--root`, `--skip-hooks`, and `--json`.
- Local setup now writes the repository row and branch trigger policy into
  `~/.codealmanac/control.sqlite` and installs local trigger hooks unless
  `--skip-hooks` is passed.
- Added real `working-tree` local delivery support alongside commit delivery.
  It applies the worker patch to the checkout without creating a commit.
- Verified Slice 17 focused behavior with
  `uv run pytest tests/test_local_setup_workflow.py tests/test_cli.py tests/test_git_local_repository_probe.py tests/test_local_delivery_workflow.py tests/test_git_local_delivery.py tests/test_architecture.py`.
- Verified Slice 17 full gate with `uv run pytest` (`432 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 17 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 76%, CLI/public UX 18%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 18 in
  `docs/plans/2026-07-02-slice-18-local-status-and-jobs.md`.
- Added optional control DB reads for repository-by-local-root,
  branch-by-name, and filtered run listing.
- Added `app.workflows.local_status.status(...)`.
- Added `app.workflows.local_jobs` to wrap run rows with repository and branch
  context for public output.
- Added public `codealmanac local status`.
- Added public `codealmanac local jobs list`, `show`, and `logs`.
- Kept `local update` out of this slice so manual-trigger semantics can be
  designed without overloading the read surface.
- Verified Slice 18 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_local_status_workflow.py tests/test_cli.py tests/test_architecture.py`.
- Verified Slice 18 full gate with `uv run pytest` (`439 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 18 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 78%, CLI/public UX 22%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 19 in
  `docs/plans/2026-07-02-slice-19-local-update-command.md`.
- Added `app.workflows.local_update.update(...)`.
- Added public `codealmanac local update` with `--using` and `--json`.
- `local update` now requires the current checkout and branch to be configured
  by local setup, creates a `manual` trigger event for the current HEAD, and
  runs the same local worker path used by Git hooks.
- Manual triggers may rerun on the same HEAD because local capture/source
  material can change without a code commit.
- `local update` refuses to start when the branch already has a queued or
  running local job.
- Manual trigger recording can replace older pending branch triggers while
  keeping normal duplicate hook-trigger behavior unchanged.
- Verified Slice 19 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_local_update_workflow.py tests/test_cli.py tests/test_architecture.py`.
- Verified Slice 19 full gate with `uv run pytest` (`446 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 19 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 81%, CLI/public UX 26%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 20 in
  `docs/plans/2026-07-02-slice-20-local-trigger-policy-commands.md`.
- Added `app.control.list_branches(...)` for repository-scoped branch policy
  reads.
- Added `app.workflows.local_policy` for local trigger policy listing, trigger
  enable/disable, and delivery mode updates.
- Added public `codealmanac local triggers list`.
- Added public `codealmanac local triggers enable <branch> [--delivery
  commit|working-tree]`.
- Added public `codealmanac local triggers disable <branch>`.
- Added public `codealmanac local delivery set --branch <branch> --mode
  commit|working-tree`.
- Local policy commands mutate local control DB branch rows only; they do not
  install hooks, spawn workers, or run updates.
- Verified Slice 20 focused behavior with
  `uv run pytest tests/test_control_service.py tests/test_local_policy_workflow.py tests/test_cli.py tests/test_architecture.py`.
- Verified Slice 20 full gate with `uv run pytest` (`456 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 20 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 83%, CLI/public UX 30%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 21 in
  `docs/plans/2026-07-02-slice-21-prompt-manual-restoration.md`.
- Added `PromptName.OPERATION_INIT`.
- Added packaged prompt resource
  `src/codealmanac/prompts/operations/init.md`.
- Expanded base prompt resources for purpose, notability, and syntax from the
  archive doctrine while adapting them to configured Almanac roots,
  `codealmanac` naming, structured `sources:`, and no new cross-wiki links.
- Expanded ingest and garden operation prompts without restoring the old public
  `absorb` name.
- Replaced bundled `manual/build.md` with `manual/init.md`.
- Updated `ManualDocumentName` so workspace manual installation copies
  `init.md`.
- Kept public `build` command removal and agent-backed `init` runtime behavior
  out of this slice.
- Verified Slice 21 focused behavior with
  `uv run pytest tests/test_ingest_workflow.py::test_ingest_workflow_resolves_sources_runs_harness_and_refreshes_index tests/test_prompts.py tests/test_manual.py tests/test_build_workflow.py tests/test_architecture.py`.
- Verified Slice 21 full gate with `uv run pytest` (`458 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Sent the Slice 21 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 84%, CLI/public UX 30%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 22 in
  `docs/plans/2026-07-02-slice-22-init-runtime.md`.
- Added `app.workflows.init` with `initialize_workspace(...)`, `run(...)`, and
  `run_with_run(...)`.
- Removed `app.workflows.build` and the public `codealmanac build` parser and
  dispatcher path.
- Added public first-build `codealmanac init` flags for harness selection,
  foreground/background mode, `--force`, `--verbose`, `--guidance`, and
  background JSON output.
- Added `RunOperation.INIT` and durable init queue specs.
- Added `RunQueueWorkflow.queue_init(...)` and
  `RunQueueWorkflow.start_init_background(...)`.
- Updated the hidden worker drain path so queued init jobs run through
  `InitWorkflow.run_with_run(...)`.
- Added init-specific mutation policy behavior:
  `require_clean_almanac=False` allows init-created scaffold files while still
  rejecting changes outside the configured Almanac root.
- Updated diagnostics and starter README text from `codealmanac build` to
  `codealmanac init`.
- Migrated scaffold-only test setup to
  `app.workflows.init.initialize_workspace(...)`.
- Verified Slice 22 focused behavior with
  `uv run pytest tests/test_init_workflow.py tests/test_cli.py tests/test_diagnostics.py tests/test_run_queue_workflow.py tests/test_runs_service.py tests/test_build_workflow.py tests/test_architecture.py`
  (`158 passed`).
- Verified Slice 22 full gate with `uv run pytest` (`465 passed`),
  `uv run ruff check .`, `git diff --check`, `uv run codealmanac --help`, and
  `uv run codealmanac init --help`.
- Sent the Slice 22 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 87%, CLI/public UX 35%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 23 in
  `docs/plans/2026-07-02-slice-23-dev-lifecycle-cli.md`.
- Added a hidden `codealmanac dev` parser and dispatch namespace.
- Moved manual `ingest` and `garden` CLI access to
  `codealmanac dev ingest` and `codealmanac dev garden`.
- Removed top-level `ingest` and `garden` from lifecycle parser and dispatch.
- Fixed root argparse help so commands registered with `argparse.SUPPRESS`
  do not print as `==SUPPRESS==` in normal top-level help.
- Updated README update examples to use public local commands:
  `local setup`, `local update`, local trigger policy, and local jobs.
- Verified Slice 23 focused behavior with
  `uv run pytest tests/test_cli.py tests/test_architecture.py` (`113
  passed`) and
  `uv run pytest tests/test_public_contract.py tests/test_cli.py tests/test_architecture.py`
  (`140 passed`).
- Verified Slice 23 full gate with `uv run pytest` (`466 passed`),
  `uv run ruff check .`, `git diff --check`, `uv run codealmanac --help`,
  `uv run codealmanac dev ingest --help`, and
  `uv run codealmanac dev garden --help`.
- Sent the Slice 23 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 87%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 24 in
  `docs/plans/2026-07-02-slice-24-user-level-jobs-state.md`.
- Added `AppConfig.jobs_path`, defaulting to `~/.codealmanac/jobs`.
- Moved new file-backed lifecycle job records, logs, queue specs, worker locks,
  and sync ledgers to `~/.codealmanac/jobs/<workspace-id>/`.
- Preserved read compatibility for legacy repo-local `<almanac-root>/jobs/`
  run records, logs, queue specs, and sync ledgers.
- Kept `<almanac-root>/jobs/` in new scaffold `.gitignore` blocks as a
  compatibility guard so old legacy files do not dirty preflight checks.
- Updated README, bundled manual, and launch schema docs to teach
  `~/.codealmanac/jobs/<workspace-id>/` as the active lifecycle job state
  location.
- Verified Slice 24 focused behavior with
  `uv run pytest tests/test_runs_service.py tests/test_run_queue_workflow.py tests/test_sync_workflow.py tests/test_cli.py tests/test_public_contract.py tests/test_architecture.py -q`
  (`181 passed`).
- Verified Slice 24 full gate with `uv run pytest` (`466 passed`),
  `uv run ruff check .`, `git diff --check`, `uv run codealmanac --help`,
  `uv run codealmanac dev ingest --help`, and
  `uv run codealmanac dev garden --help`.
- Sent the Slice 24 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 88%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 5%.
- Planned Slice 25 in
  `docs/plans/2026-07-02-slice-25-hosted-baseline-convergence.md`.
- Created clean hosted worktree
  `/Users/rohan/.config/superpowers/worktrees/usealmanac/hosted-baseline-convergence`
  from current `origin/main`.
- Created and pushed hosted branch `codex/hosted-baseline-convergence`.
- Reapplied the small CodeAlmanac-hosted rename/deploy-surface change on top
  of current hosted main without merging the older divergent
  `codex/cli-hosted-redesign-docs` branch.
- Preserved newer hosted conversation-sync work from `origin/main`.
- Pushed hosted commit `1d237db chore: rename hosted deploy surfaces`.
- Verified hosted backend with `uv run pytest` (`290 passed`),
  `uv run ruff check .`, `uv run ruff format --check .`, and
  `uv run pytest tests/test_modal_worker_contract.py` (`9 passed`).
- Verified hosted frontend with `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), and `npm run build`.
- Sent the Slice 25 RelayForge update and recorded progress as:
  CodeAlmanac backend/local 88%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 8%, hosted frontend/onboarding 5%, and
  infra/deploy rename 10%.
- Planned Slice 26 in
  `docs/plans/2026-07-02-slice-26-workos-authkit-api-foundation.md`.
- Created hosted branch `codex/workos-authkit-api-foundation` from the Slice
  25 hosted convergence worktree.
- Migrated hosted browser auth from Supabase Auth helpers to WorkOS/AuthKit:
  `AuthKitProvider`, AuthKit proxy composition, `/sign-in`,
  `handleAuth(...)` callback, WorkOS-backed server auth helpers, and POST
  server-action sign-out.
- Removed frontend Supabase auth packages and deleted
  `frontend/src/lib/supabase/client.ts` and
  `frontend/src/lib/supabase/server.ts`.
- Added backend WorkOS token verification through JWKS and mapped access-token
  `sub` to `workos_user_id`.
- Removed the old backend Supabase Auth adapter from active auth wiring.
- Changed hosted user identity storage from `supabase_user_id uuid` to
  `workos_user_id text`, including CLI token, conversation-source, analytics,
  events, and migration surfaces.
- Kept repository reads/writes/PRs/commits on GitHub App/user tokens; WorkOS
  now owns human identity and sessions only.
- Verified Slice 26 backend focused behavior with
  `uv run pytest tests/test_identity_auth_contract.py tests/test_identity_api_contract.py tests/test_hosted_conversation_sync_contract.py tests/test_store_timestamps_contract.py tests/test_analytics_contract.py -q`
  (`31 passed`).
- Verified Slice 26 backend expanded behavior with
  `uv run pytest tests/test_architecture_contract.py tests/test_repositories_api_contract.py tests/test_wiki_api_contract.py tests/test_repositories_contract.py tests/test_updates_contract.py tests/test_wiki_contract.py -q`
  (`126 passed`).
- Verified Slice 26 full hosted backend gate with `uv run pytest` (`286
  passed`), `uv run ruff check .`, and `uv run ruff format --check .`.
- Verified Slice 26 hosted frontend with `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), and `npm run build`.
- `npm run build` still emits the known non-blocking CSS optimizer warning
  about a comment containing `m-* utility`.
- Pushed hosted commit `5858ae1 feat: migrate hosted auth to WorkOS` to
  `origin/codex/workos-authkit-api-foundation`.
- Sent the Slice 26 RelayForge update.
- Recorded progress as: CodeAlmanac backend/local 88%, CLI/public UX 40%,
  CodeAlmanac-hosted backend/auth/API 28%, hosted frontend/onboarding 15%, and
  infra/deploy rename 10%.
