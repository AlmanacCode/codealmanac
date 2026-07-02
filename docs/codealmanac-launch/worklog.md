# Launch Worklog

## 2026-07-02

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
