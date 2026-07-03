# Verification Matrix

Status: active.

## Auth / API

Must prove:

- WorkOS/AuthKit is the cloud identity provider.
- `codealmanac login` opens browser/device auth, stores local auth under
  `~/.codealmanac/`, and `codealmanac whoami` succeeds from a fresh shell.
- Public API routes verify WorkOS-backed credentials.
- Capture hooks use a narrow capture credential, not an unrestricted human
  token.

Current evidence:

- Slice 26 implemented hosted WorkOS/AuthKit browser session handling and
  FastAPI bearer-token verification.
- Slice 27 added hosted `/v1` CLI auth aliases:
  `/v1/auth/cli/start`, `/v1/auth/cli/sessions/{session_id}`,
  `/v1/auth/cli/sessions/{session_id}/complete`,
  `/v1/auth/cli/sessions/{session_id}/poll`, `/v1/me`, and
  `/v1/auth/logout`.
- `backend/tests/test_cli_auth_api_contract.py` proves `/v1` CLI login start,
  one-time token polling, `/v1/me`, `/v1/auth/logout`, and legacy `/api`
  compatibility.
- Slice 27 added `codealmanac login`, `codealmanac whoami`, and
  `codealmanac logout`.
- Slice 77 Chrome production retry proved the end-to-end CLI login loop from
  an isolated temp `HOME`: local `codealmanac login --force --no-browser`
  printed a fresh `https://www.codealmanac.com/cli-login` URL, Chrome rendered
  `CLI login approved`, the terminal completed with `Signed in as rohans0509`,
  `codealmanac whoami` succeeded, and `codealmanac repo status` resolved
  `AlmanacCode/codealmanac` on `dev` with `triggers: 3`.
- Slice 77 CLI launch-surface verification proved root help is cloud-first,
  hidden compatibility parsers still parse `sync status` and `jobs`, and
  `setup --yes` stays in prompt-mode instead of silently opening the browser.
- Slice 77 published PyPI `codealmanac` `0.1.7` through GitHub Actions run
  `28670450240`. A fresh public install with `uv tool install --python 3.12
  --refresh --no-cache --force codealmanac==0.1.7` returned version `0.1.7`,
  showed the cloud-first root help, and rendered the new setup output.
- Slice 78 added root `codealmanac status`. Local tests prove signed-in status
  aggregates validated cloud identity, current checkout repository, trigger
  count, local capture credential, providers, and optional remote capture
  credentials. Signed-out JSON status returns `auth.authenticated=false`,
  `repo=null`, and local capture state without calling repo APIs.
- Slice 78 wheel smoke installed
  `dist/codealmanac-0.1.8-py3-none-any.whl` into an isolated Python `3.12.9`
  venv. The binary returned version `0.1.8`, showed `status` in root help, and
  rendered signed-out human and JSON `codealmanac status` output.
- `tests/test_cloud_auth_service.py` proves `~/.codealmanac/auth.json`
  save/load/delete behavior, mode `0600`, malformed-file recovery, identity
  fetch, and logout.
- `tests/test_cloud_login_workflow.py` proves browser login opens the hosted
  verification URL, no-browser mode does not open a browser, successful polling
  stores the hosted CLI token, and timeout does not store a token.
- `tests/test_cli.py` proves cloud login, `whoami`, `logout`, and cloud-first
  `setup` work from outside a Git repo.
- Slice 27 full gates passed:
  hosted backend `uv run pytest -q` (`289 passed`), hosted ruff and format
  checks, `codealmanac` `uv run pytest -q` (`474 passed`), `codealmanac` ruff,
  `git diff --check`, and `login/setup/whoami/logout --help`.
- Slice 28 added hosted capture credential routes:
  `POST /v1/capture/credentials`, `GET /v1/capture/status`, and
  `POST /v1/capture/credentials/revoke`.
- `backend/tests/test_capture_tokens_api_contract.py` proves capture
  credential issue returns the raw `cap_...` token once, status returns
  summaries only, revoke works through the CLI token, and capture tokens do not
  authenticate `/v1/me`.
- Slice 28 added local `~/.codealmanac/capture.json` mode `0600`,
  `~/.codealmanac/capture-events/events.jsonl`, and public
  `codealmanac capture status/enable/repair/disable`.
- `tests/test_cloud_capture_service.py` proves capture credential storage,
  cloud status checks, provider hook install/removal, and diagnostic hook event
  recording.
- `tests/test_cli.py` proves the public capture CLI path signs in, enables
  capture, checks status with the cloud, records a hidden hook event, disables
  capture, and revokes the stored capture token.
- Slice 28 full gates passed:
  hosted backend `uv run pytest -q` (`291 passed, 1 warning`), hosted ruff and
  format checks, hosted frontend `npm run test:routes` (`26 passed`),
  `npm run test:frontend` (`41 passed`), hosted `npm run build`,
  `codealmanac` `uv run pytest -q` (`477 passed`), `codealmanac` ruff,
  `git diff --check`, and capture help checks.
- Slice 48 aligned the hosted WorkOS/AuthKit API boundary with provider
  documentation and the launch hierarchy rule.
- `backend/src/almanac/server/deps.py` now uses FastAPI
  `HTTPBearer(auto_error=False)` for bearer parsing instead of hand-rolled
  `Authorization` header string parsing.
- `backend/src/almanac/integrations/workos/client.py` documents that WorkOS
  Python sealed-session helpers are for direct `wos_session` cookie sessions;
  this app's FastAPI boundary receives AuthKit access-token JWTs from the Next
  server layer and validates them with WorkOS JWKS plus PyJWT.
- `WorkOSClaims` now carries the documented AuthKit access-token hierarchy:
  WorkOS user id, session id, organization id, role, roles, permissions,
  entitlements, and feature flags.
- `backend/tests/test_architecture_contract.py` prevents regression to manual
  bearer string parsing.
- Slice 48 auth-focused verification passed with backend focused tests
  (`86 passed, 1 warning`), full backend tests (`357 passed, 1 warning`),
  route tests (`27 passed`), backend ruff/compileall, frontend lint/build, and
  `git diff --check`.
- Slice 49 encrypted hosted GitHub provider tokens at rest with a
  Fernet/MultiFernet store boundary. `UsersStore` now writes
  `oauth_token_ciphertext` and `refresh_token_ciphertext`; the domain `User`
  still exposes decrypted provider tokens only after the store boundary.
- Slice 49 uses `Settings.github_token_encryption_keys` and wires the concrete
  cipher in `backend/src/almanac/app.py`. Decrypt failures are mapped by the
  users service to provider-unavailable auth errors instead of leaking crypto
  details to API callers.
- Slice 49 migration guards prove legacy plaintext `oauth_token` and
  `refresh_token` columns are invalidated/dropped, not renamed into ciphertext
  columns.
- Slice 49 verification passed with focused backend auth/storage tests
  (`99 passed, 1 warning`), full hosted backend tests
  (`361 passed, 1 warning`), backend `uv run ruff check .`, backend
  `uv run python -m compileall src modal_app -q`, hosted frontend route tests
  (`27 passed`), focused Modal hydration test (`1 passed`), and
  `npm run backend:smoke`.
- Slice 49 set `GITHUB_TOKEN_ENCRYPTION_KEYS` in Doppler `codealmanac/prd`.
  Supabase migration application and Render/Vercel deploy were intentionally
  deferred to the next batched deploy gate.
- Rate limits were explicitly postponed on 2026-07-02. They remain future
  abuse-control work before broad public scale, but current launch verification
  should not claim `429` behavior for auth, capture, run-start, or wiki-read
  endpoints.
- Slice 74 handled upstream GitHub provider rate limits, not product abuse
  limits. Production `codealmanac repo status` reached `/v1/repositories/resolve`
  with a valid CLI token, then GitHub returned HTTP 403 with
  `API rate limit exceeded` from the collaborator permission endpoint.
- Hosted backend now maps GitHub `403/429` rate-limit responses to
  provider-unavailable behavior. Focused hosted tests prove rate-limit mapping,
  account-scoped provider failures, repository permission provider failures,
  identity token-refresh behavior, and API error envelopes.
- Slice 74 then removed the user-token hot path for repo-scoped authorization.
  A live `codealmanac/prd` probe proved the GitHub App installation token can
  read collaborator permission for `AlmanacCode/codealmanac` and `rohans0509`,
  returning `admin`. Repository authorization now uses the repo installation
  token, and account-scoped repo detail no longer calls the user-installations
  lookup path.
- Production retry after Render deploy `dep-d93s4im7r5hc73c8hh00` passed:
  `codealmanac repo status` returned repo id `1212149375`, account id
  `264516179`, branch `dev`, and `triggers: 3`. `codealmanac repo triggers
  list`, `codealmanac capture status --check-cloud --json`, and
  `https://api.codealmanac.com/api/health` also passed.
- Gap: PyPI `0.1.5` does not expose the canonical
  `codealmanac repo list`; invoking `codealmanac repos list` also returns an
  invalid-command error because `repos` is intentionally not a namespace.
  Do not promise repository listing until Slice 75 is published and deployed.
- Slice 29 added capture-token upload routes:
  `POST /v1/capture/artifacts` and `POST /v1/capture/turns`.
- `backend/tests/test_capture_upload_api_contract.py` proves capture tokens can
  upload raw transcript artifacts, CLI tokens cannot upload artifacts, artifact
  responses do not echo transcript text, turn metadata carries `artifactRef`,
  and SQL stores `source_ref` without `conversation_messages`.
- Slice 29 added local hook transcript upload through the existing hidden
  `codealmanac __capture-hook --provider codex|claude` command.
- `tests/test_capture_transcript_upload.py` proves Codex hook payloads preserve
  hook turn IDs, Claude payloads get deterministic fallback turn IDs, missing
  transcript paths record skipped events, and no provider work is blocked.
- Slice 29 focused gates passed:
  hosted backend capture/conversation/architecture tests (`88 passed, 1
  warning`), hosted ruff, local capture/CLI/public/architecture tests
  (`147 passed`), and local ruff.
- Slice 30 added internal source-artifact reads:
  `GET /api/internal/source-artifacts?ref=...`.
- `backend/tests/test_internal_route_contract.py` proves the source-artifact
  read route rejects missing internal secrets and returns raw bytes, content
  type, source-ref, sha256, and byte-length headers when authenticated.
- Slice 30 changed hosted conversation ingest to require captured source refs
  before scheduling worker runs.
- `backend/tests/test_capture_upload_api_contract.py` proves capture-token turn
  upload stores `source_ref` and schedules ingest state once the turn is
  completed, routable, and ref-backed.
- `backend/tests/test_conversation_ingest_scheduler.py` proves run source JSON
  contains source refs and no inline `source_text`, and proves turns without
  source refs are not scheduled.
- Slice 36 added hosted CLI-token repository routes:
  `POST /v1/repositories/resolve`,
  `GET /v1/repositories/{repo_id}/triggers`, and
  `PUT /v1/repositories/{repo_id}/triggers`.
- `backend/tests/test_cli_repositories_api_contract.py` proves those routes
  authenticate with the CLI token, resolve from `fullName`, preserve slash
  branches in the JSON body, and call the repository service.
- Slice 37 added hosted CLI-token run read routes:
  `GET /v1/repositories/{repo_id}/runs`, `GET /v1/runs/{run_id}`, and
  `GET /v1/runs/{run_id}/events`.
- `backend/tests/test_cli_runs_api_contract.py` proves those routes
  authenticate with the CLI token, return page/detail/event DTOs, and preserve
  run-event payloads by reference.
- Slice 38 added browser-session repo resolution:
  `POST /api/repositories/resolve`.
- `backend/tests/test_repositories_api_contract.py` proves the route
  authenticates with the browser session, resolves by `fullName`, uses
  `Action.VIEW_REPO`, and returns `repoId`, `accountId`, `fullName`, and
  `defaultBranch`.
- Slice 39 added hosted CLI-token manual run start:
  `POST /v1/repositories/{repo_id}/runs`.
- `backend/tests/test_cli_runs_api_contract.py` proves the route
  authenticates with the CLI token, accepts branch names in the JSON body, and
  returns a `RunDTO`.
- Slice 43 verified production GitHub App permissions through GitHub's App
  API. App slug `almanac-bot` owned by `AlmanacCode` has `checks: write`,
  `contents: write`, and `pull_requests: write`.
- Slice 57 hardened the browser sign-in path. Public CTAs now enter
  `/login`, protected routes redirect to `/login?next=...`, and `/sign-in` is
  the only WorkOS/AuthKit start endpoint.
- Slice 57 changed the login button to a normal anchor so `/sign-in` owns the
  WorkOS PKCE verifier cookie setup. Plain `/login` defaults to `/setup`.
- Slice 57 changed the AuthKit callback to reject completed sessions that do
  not include GitHub OAuth tokens and to map session-verifier failures back to
  explicit GitHub-only login errors.
- Slice 57 verification passed: hosted `npm run test:routes` (`27 passed`),
  `npm run test:frontend` (`52 passed`), `npm run lint`, `npm run build`,
  `git diff --check`, Vercel production deploy
  `codealmanac-hosted-jaxnxk6oq-thealmanac.vercel.app`, production `/setup`
  redirect smoke, production `/sign-in` verifier-cookie smoke,
  browser-harness `/login` smoke, and Vercel error-log check.
- Slice 58 repaired production Supabase schema drift. Production had old
  Supabase Auth-era `users.supabase_user_id` and plaintext token columns while
  the deployed backend expected WorkOS/AuthKit `users.workos_user_id` and
  encrypted token columns.
- Hosted migration
  `supabase/migrations/20260703000000_repair_workos_identity_schema.sql`
  records the repair path. The migration converts legacy identity columns and
  foreign keys to WorkOS text ids, adds `oauth_token_ciphertext` and
  `refresh_token_ciphertext`, removes plaintext token columns, and recreates
  foreign keys to `users(workos_user_id)`.
- Production migration history includes `20260703000000` plus the previously
  drifted launch migrations. The repair was applied through Doppler-backed
  `psql` because Supabase CLI migration commands hit a pooler
  prepared-statement conflict.
- Production DB check proved `rohans0509` has an active WorkOS user row with
  encrypted GitHub access and refresh tokens present.
- Slice 58 hosted verification passed: focused backend auth tests
  (`24 passed`), Render deploy `dep-d93h21h9rddc73a2q0g0` live on commit
  `01c8463`, backend health `{"status":"ok"}`, Vercel production Ready, and
  browser-harness signed-in `/setup` rendering `rohans0509`, `ReverieOne`, and
  `AlmanacCode`.
- A fresh isolated PyPI `codealmanac==0.1.2` install was retested through
  Chrome on 2026-07-03. `codealmanac setup --no-browser --skip-instructions`
  printed a `www.codealmanac.com/cli-login` URL, Chrome rendered
  `CLI login approved`, setup exited signed in as `rohans0509`, `whoami`
  returned `https://api.codealmanac.com`, and
  `capture status --check-cloud --json` reached production.
- Slice 60 repaired capture credential schema drift. The backend already
  queried `CaptureTokenRow`, but production Supabase lacked
  `public.capture_tokens`, causing signed-in repository settings to fail at
  `GET /api/capture/status`.
- Hosted migration
  `supabase/migrations/20260703010000_capture_tokens.sql` creates
  `public.capture_tokens`, grants service-role access, enables forced RLS, and
  creates `capture_tokens_backend_access`.
- The clean-slate init migration now includes `capture_tokens`, so fresh
  environments and repaired production use the same table shape.
- Production DB verification proved `to_regclass('public.capture_tokens')`
  resolves and `pg_policies` includes `capture_tokens_backend_access` for
  `{postgres,service_role}`.
- Browser-harness verified signed-in production repository settings loads at
  `/dashboard/accounts/264516179/repositories/1212149375/settings` and renders
  GitHub access, capture status, maintained branches, and delivery settings.
- Render logs after the repair show fresh signed-in
  `GET /api/capture/status` requests returning `200 OK`.
- Slice 60 hosted verification passed: Render deploy
  `dep-d93lnpl7vvec73fpne40` is live on commit `5220adf8`; production health
  returned `{"status":"ok"}`;
  `uv run pytest tests/test_architecture_contract.py tests/test_capture_tokens_api_contract.py`
  (`76 passed, 1 warning`) and `uv run ruff check .`.
- Slice 61 hardened GitHub webhook intake against provider schema drift.
  `services/github` now routes parsing by `X-GitHub-Event`; unsupported event
  families stay ignored even when their payload includes `repository` or
  `installation` objects.
- Slice 61 corrected installation actions to GitHub's schema names:
  `suspend` and `unsuspend`. The old `suspended` and `unsuspended` strings are
  ignored.
- Slice 61 changed `installation_repositories.added` and `.removed` messages to
  carry parent account and installation snapshots. Identity fanout upserts those
  parents before repository fanout syncs repository scope.
- Slice 61 hosted verification passed: focused webhook/fanout tests
  (`23 passed`), adjacent repository/update tests (`55 passed`), full backend
  suite (`370 passed, 1 warning`), `uv run ruff check .`, Render deploy
  `dep-d93lvet7vvec73fpsag0` live on commit `c9b0da1`, backend health
  `{"status":"ok"}`, and production signed-webhook smoke persisted
  `smoke-slice61-1783062568` as `event=check_run`, `action=requested_action`,
  `status=ignored`.
- Slice 62 hardened branch-push update triggers against self-delivery loops.
  `BranchPushUpdates.plan(...)` now ignores non-truncated pushes with no changed
  paths and non-truncated pushes whose changed paths are all under `.almanac/`
  before trigger policy lookup, capacity checks, or run creation.
- Slice 62 keeps truncated push payloads eligible for runs because GitHub caps
  the push commits array, so visible changed paths are incomplete when
  `commits_truncated=True`.
- Slice 62 changed hosted delivery to use deterministic
  `docs almanac: <worker summary>` commit and PR titles, with
  `docs almanac: update wiki` as the fallback. Open-PR delivery now uses
  `almanac/update-<run>` branches instead of `almanac/wiki-<run>` branches.
- Slice 62 hosted verification passed: focused update tests (`49 passed`),
  adjacent webhook/update tests (`65 passed`), full backend suite
  (`375 passed, 1 warning`), `uv run ruff check .`, `python -m compileall
  backend/src backend/modal_app -q`, `git diff --check`, Render deploy
  `dep-d93mceekanas73aeia30` live on commit `fdad34d`, and backend health
  returned `{"status":"ok"}` on both the canonical API domain and Render URL.
- Slice 63 production frontend verification passed: frontend tests
  (`52 passed`), route tests (`27 passed`), frontend lint, Next build,
  `git diff --check`, Vercel production deploy
  `codealmanac-hosted-gutvigm88-thealmanac.vercel.app` aliased to
  `https://www.codealmanac.com`, and browser-harness/Chrome signed-in checks
  for setup, repository list, repository settings, live settings summary,
  reversible branch trigger save/restore, and the CLI setup guide.

## CodeAlmanac Local Repo

Must prove:

- CLI parser exposes the agreed public launch commands.
- Old public `ingest` and `garden` are removed or hidden from normal help.
- Local read commands work without local setup when committed wiki markers
  exist.
- Local maintenance requires explicit local setup or trigger enablement.
- Local trigger hooks only record events for configured branches.
- Local worker uses the engine contract, not public CLI strings.
- Local run metadata is stored in `~/.codealmanac/control.sqlite`.
- Local run artifacts are stored in `~/.codealmanac/runs/<run-id>/`.
- Local worker workspaces are stored in
  `~/.codealmanac/workspaces/<run-id>/`.
- Auto-update does not replace the current running process.

Current evidence:

- Slice 1 added `src/codealmanac/services/control/` with the launch control
  tables: `repositories`, `branches`, `sessions`, `turns`, `turn_branches`,
  `trigger_events`, `runs`, `run_events`, and `deliveries`.
- `AppConfig.control_db_path` defaults to `~/.codealmanac/control.sqlite`.
- `tests/test_control_service.py` proves the control DB path, schema creation,
  launch vocabulary constraints, and separation from the per-repo query DB.
- `tests/test_architecture.py` now checks that the control schema, store, and
  service facade stay split.
- Slice 2 added `app.control.upsert_repository`,
  `app.control.set_branch_policy`, `app.control.record_trigger_event`, and
  `app.control.list_trigger_events`.
- `tests/test_control_service.py` proves disabled branches write no trigger
  rows, enabled branches create pending trigger rows, duplicate heads are
  ignored, and newer pending heads supersede older pending trigger rows.
- Slice 3 added the hidden Git-hook dispatcher
  `codealmanac __record-local-trigger`.
- `tests/test_git_workspace_probe.py` proves the Git probe reads repository
  root, branch, and HEAD SHA from a real temporary Git repository.
- `tests/test_cli.py` proves the hidden dispatcher records a pending trigger
  event through the control DB and is JSON-renderable for debugging.
- Slice 4 added `app.local_hooks.install()` and `app.local_hooks.uninstall()`.
- `tests/test_local_hooks.py` proves hook installation for `post-commit`,
  `post-merge`, and `post-rewrite`, reinstall idempotency, executable hook
  files, user hook preservation, and managed-block uninstall.
- Slice 5 added `app.control.create_run`, `app.control.update_run`,
  `app.control.append_run_event`, and `app.control.list_run_events`.
- `tests/test_control_service.py` proves SQL-backed run rows, launch run
  statuses, run references, terminal timestamps, and ordered run event
  sequencing.
- Slice 6 added `app.control.claim_next_trigger`.
- `tests/test_control_service.py` proves pending trigger claiming marks the
  trigger `claimed`, sets `claimed_at`, creates a queued run, copies
  `head_sha` into `expected_head_sha`, and returns an empty result when no
  pending trigger exists.
- Slice 7 added `app.engine_runs` and
  `src/codealmanac/services/engine_runs/`.
- `AppConfig.run_artifacts_path` defaults to `~/.codealmanac/runs`.
- `tests/test_engine_runs_service.py` proves `request.json` and `result.json`
  round-trip under `~/.codealmanac/runs/<run-id>/`.
- `tests/test_engine_runs_service.py` proves `request.json` stores
  `sources_path` and `source_bundle_ref`, not inline source/session/conversation
  payloads.
- `tests/test_engine_runs_service.py` proves engine result commit subjects use
  the `docs almanac:` style.
- `tests/test_architecture.py` proves `engine_runs` stays separate from CLI,
  control DB, and integration concerns.
- Slice 8 added `app.worker_workspaces` and
  `src/codealmanac/services/worker_workspaces/`.
- `AppConfig.worker_workspaces_path` defaults to
  `~/.codealmanac/workspaces`.
- `tests/test_worker_workspaces_service.py` proves the worker workspace layout:
  `repo/`, `sources/`, and `run/`.
- `tests/test_worker_workspaces_service.py` proves existing run workspaces
  raise a conflict instead of being silently removed.
- `tests/test_worker_workspaces_service.py` proves the concrete Git adapter
  creates a detached worktree at the expected head SHA.
- `tests/test_architecture.py` proves Git/subprocess mechanics stay in the Git
  integration, not the worker workspace service/store.
- Slice 9 added `app.workflows.local_runs.prepare_next`.
- `tests/test_local_run_preparation_workflow.py` proves a pending trigger is
  claimed, a worker workspace is created, an engine `request.json` is written,
  `source_bundle_ref` and `request_ref` are stored on the control run, and a
  normalized run event is appended.
- `tests/test_local_run_preparation_workflow.py` proves no pending trigger
  returns a typed no-op.
- `tests/test_local_run_preparation_workflow.py` proves a claimed run is marked
  `failed` with a normalized error when the repository has no local root path.
- `tests/test_architecture.py` proves the local run preparation workflow
  orchestrates services without importing integrations, SQL, or subprocess
  mechanics.
- Slice 10 added branch-head staling during trigger recording.
- `tests/test_control_service.py` proves a newer trigger marks older queued and
  running runs on the same branch as `stale`.
- `tests/test_control_service.py` proves terminal runs and same-head queued
  runs are preserved.
- `tests/test_control_service.py` proves stale runs receive normalized status
  run events.
- Slice 11 added branch session selection and source bundle materialization.
- `tests/test_control_service.py` proves branch selection returns distinct full
  sessions through `turn_branches`.
- `tests/test_source_bundles_service.py` proves session source files are copied
  into `sources/sessions/<provider>/` and recorded in `manifest.json`.
- `tests/test_local_run_preparation_workflow.py` proves local run preparation
  materializes the source bundle before writing the engine request.
- `tests/test_architecture.py` proves source-bundle materialization remains a
  separate service boundary.
- Slice 12 added deterministic local commit delivery.
- `tests/test_deliveries_service.py` proves delivery rows are created and
  updated against the existing control DB `deliveries` table.
- `tests/test_local_delivery_workflow.py` proves successful delivery commits a
  worker wiki patch, moved heads mark runs `stale` and skip delivery, and empty
  worker diffs skip delivery while marking the run `succeeded`.
- `tests/test_git_local_delivery.py` proves the native Git delivery adapter
  collects wiki-only patches, applies them to the real checkout, commits with
  `docs almanac:`, and rejects worker changes outside the configured Almanac
  root.
- `tests/test_architecture.py` proves Git delivery mechanics stay in
  `integrations/workspaces/git/delivery.py`, not in the workflow.
- Slice 13 added local engine execution.
- `tests/test_local_engine_workflow.py` proves the workflow reads a prepared
  engine request, runs the harness in the worker repo, writes `result.json`,
  stores `result_ref`, and records normalized run events.
- `tests/test_local_engine_workflow.py` proves failed harness runs mark the
  control run `failed` and write a failed engine result.
- `tests/test_local_engine_workflow.py` proves a missing prepared request fails
  the control run without invoking the harness.
- `tests/test_architecture.py` proves local engine execution stays separate
  from Git delivery, subprocess mechanics, SQL, and CLI strings.
- Slice 14 added local worker orchestration.
- `tests/test_local_worker_workflow.py` proves one pending trigger can be
  prepared, executed by the local engine, and delivered through the local
  delivery workflow.
- `tests/test_local_worker_workflow.py` proves no pending trigger is a typed
  no-op, preparation failure stops before engine execution, and engine failure
  stops before delivery.
- `tests/test_local_worker_workflow.py` proves delivery is skipped when a newer
  trigger marks the run `stale` while the engine is running.
- `tests/test_architecture.py` proves the local worker only composes the local
  workflows and does not import harness, delivery, SQL, subprocess, or
  integration mechanics directly.
- Slice 15 added the hidden local worker CLI command.
- `tests/test_cli.py` proves `codealmanac __run-local-worker --json` returns a
  typed no-op when no pending trigger exists.
- `tests/test_cli.py` proves `codealmanac __run-local-worker --repository-id
  ... --branch-id ... --json` processes one trigger through preparation,
  engine execution, and delivery.
- Slice 16 connected local Git hooks to detached local worker spawning.
- `tests/test_cli.py` proves `codealmanac __record-local-trigger --spawn-worker
  --json` spawns a local worker only when a trigger event is recorded.
- `tests/test_cli.py` proves ignored trigger events do not spawn a worker.
- `tests/test_local_hooks.py` proves installed Git hook blocks include
  `--spawn-worker`.
- `tests/test_local_worker_spawner.py` proves the subprocess command targets
  the hidden `__run-local-worker` CLI with repository and branch filters.
- Slice 17 added `app.workflows.local_setup.setup(...)` and public
  `codealmanac local setup`.
- `tests/test_local_setup_workflow.py` proves local setup registers the GitHub
  checkout, enables the selected branch trigger policy, records the default
  commit delivery mode, installs hooks, supports `--skip-hooks`, and supports
  `working_tree` delivery mode.
- `tests/test_git_local_repository_probe.py` proves the concrete Git probe
  reads repository root, branch, HEAD SHA, and GitHub `origin` identity from a
  real temporary Git checkout.
- `tests/test_cli.py` proves `codealmanac local setup --delivery working-tree
  --skip-hooks --json` records the local checkout and emits typed JSON.
- `tests/test_local_delivery_workflow.py` proves working-tree delivery applies
  a worker patch without creating a commit SHA.
- `tests/test_git_local_delivery.py` proves the native Git delivery adapter
  applies a worker wiki patch to the checkout without moving HEAD.
- `tests/test_architecture.py` proves local setup Git detection stays in
  `integrations/workspaces/git/repository.py`, not in the workflow or CLI.
- Slice 18 added the public local read surface.
- `tests/test_control_service.py` proves local repository lookup by root path,
  branch lookup by repository/name, and filtered run listing by status, branch,
  and limit.
- `tests/test_local_status_workflow.py` proves local status reports configured
  checkout branches, unconfigured branches, and unavailable Git checkouts.
- `tests/test_cli.py` proves `codealmanac local status` renders the current
  checkout, configured repository, branch trigger state, and delivery mode.
- `tests/test_cli.py` proves `codealmanac local jobs list --json`,
  `codealmanac local jobs show <run-id>`, and `codealmanac local jobs logs
  <run-id>` read SQL-backed local run rows and run events.
- `tests/test_architecture.py` continues to prove CLI parser/dispatch/render
  boundaries stay split by command domain.
- Slice 36 added typed `cloud_repositories` service models, requests, ports,
  and service methods over the hosted `/v1` repository trigger routes.
- `tests/test_cloud_repositories_service.py` proves the service uses the
  stored hosted CLI token and passes branch, enabled, and delivery-mode data to
  the cloud client without inline auth handling in commands.
- `tests/test_cloud_repo_workflow.py` proves the current GitHub checkout is
  resolved before trigger reads/writes and that enable/disable/delivery changes
  call the cloud service with the expected branch policy patch.
- `tests/test_cli.py` proves `codealmanac repo status`,
  `codealmanac repo triggers list`, `repo triggers enable`, `repo triggers
  disable`, and `repo delivery set` work through the public CLI.
- Slice 19 added public manual local update.
- `tests/test_control_service.py` proves manual trigger events can replace a
  pending same-head branch trigger without changing normal duplicate
  hook-trigger behavior.
- `tests/test_local_update_workflow.py` proves `local update` creates a manual
  trigger, runs the local worker, commits with the `docs almanac:` subject
  style, records the expected run-event stream, allows same-head reruns after a
  completed job, refuses duplicate active branch jobs, and requires a
  configured branch.
- `tests/test_cli.py` proves `codealmanac local update --json` runs the manual
  local worker path and returns typed trigger, worker, run, and delivery data.
- `tests/test_architecture.py` proves local update only composes local status,
  control trigger recording, and the local worker; it does not import Git,
  harness, delivery, subprocess, or SQL internals directly.
- Slice 20 added local trigger and delivery policy commands.
- `tests/test_control_service.py` proves configured branch policy rows can be
  listed by repository in branch-name order.
- `tests/test_local_policy_workflow.py` proves local policy listing, trigger
  enable, trigger disable, delivery mode changes, delivery-mode preservation,
  trigger-state preservation, and configured-repository validation.
- `tests/test_cli.py` proves `codealmanac local triggers list`,
  `codealmanac local triggers enable <branch> --delivery ...`,
  `codealmanac local triggers disable <branch>`, and
  `codealmanac local delivery set --branch ... --mode ...`.
- `tests/test_architecture.py` proves local policy only composes local status
  and control policy methods; it does not import integrations, SQL,
  subprocesses, workers, harnesses, or delivery mechanics.
- Slice 21 restored prompt and manual resources for init-first-build.
- `src/codealmanac/prompts/operations/init.md` is now the packaged first-build
  operation prompt, and `PromptName.OPERATION_INIT` resolves it.
- `src/codealmanac/manual/init.md` replaced the bundled `build.md` manual
  teaching surface.
- `tests/test_prompts.py` proves every packaged prompt enum can be rendered,
  including init, ingest, garden, and update operation prompts.
- `tests/test_manual.py` proves bundled manual inventory installs `init.md`.
- `tests/test_build_workflow.py` proves initialized workspaces receive
  `manual/init.md`.
- `tests/test_architecture.py` proves prompt/manual first-build resources use
  init naming and no longer package `operations/build.md` or `manual/build.md`.
- Slice 22 added `app.workflows.init` and removed `app.workflows.build`.
- `src/codealmanac/workflows/init/` owns scaffold-only initialization plus
  agent-backed first-build runs.
- `codealmanac init` now accepts `--using`, `--background`, `--force`,
  `--verbose`, and `--json`; public `codealmanac build` is not parsed.
- `RunOperation.INIT` and init queue specs are durable under the existing
  file-backed run store.
- `RunQueueWorkflow.start_init_background(...)` queues init work and the hidden
  worker drains it through `InitWorkflow.run_with_run(...)`.
- `LifecycleMutationPolicy(require_clean_almanac=False)` lets init create its
  starter root while preserving the outside-Almanac mutation safety check.
- `tests/test_init_workflow.py` proves foreground init, populated-wiki refusal,
  `--force`, and background queue draining.
- `tests/test_cli.py` proves foreground/background `codealmanac init` behavior
  and public `build` parser removal.
- `tests/test_runs_service.py` proves init run specs accept init payload and
  reject source inputs.
- `tests/test_architecture.py` proves init dispatch replaces build dispatch.
- Slice 23 moved manual `ingest` and `garden` entrypoints under hidden
  `codealmanac dev`.
- `tests/test_cli.py` proves top-level help excludes `ingest`, `garden`, and
  `dev`, top-level `ingest`/`garden` are rejected, and
  `dev ingest`/`dev garden` preserve the existing foreground/background
  behavior.
- `tests/test_public_contract.py` proves README update examples use public
  local commands instead of top-level ingest/garden.
- `tests/test_architecture.py` proves `dev` is a separate CLI parser/dispatch
  domain and lifecycle dispatch no longer owns manual ingest/garden commands.
- Slice 24 moved file-backed lifecycle job state from repo-local
  `<almanac-root>/jobs/` to `~/.codealmanac/jobs/<workspace-id>/`.
- `AppConfig.jobs_path` defaults to `~/.codealmanac/jobs`.
- `RunsService` now writes new run records, event logs, queue specs, and
  worker locks to the user-level workspace jobs directory while reading
  legacy repo-local run records when needed.
- `SyncLedgerStore` now writes `sync-ledger.json` under the same user-level
  workspace jobs directory while reading legacy repo-local ledgers for
  compatibility.
- `tests/test_runs_service.py`, `tests/test_run_queue_workflow.py`,
  `tests/test_sync_workflow.py`, and `tests/test_cli.py` prove new jobs paths,
  legacy read fallback, sync-ledger migration behavior, and background queue
  specs.
- `tests/test_architecture.py` proves the run store remains split across
  factory, IO, locks, queries, streaming, transitions, and service path
  selection.
- Slice 31 added `codealmanac.maintenance` as the package API for non-CLI
  callers.
- `tests/test_maintenance_api.py` proves typed maintenance requests route to
  the real init and ingest workflows, preserve run metadata, and reject
  operation-specific invalid fields.
- `tests/test_architecture.py` proves the maintenance API is a package edge
  over workflows and request models, not a CLI or integration wrapper.
- Slice 31 full CodeAlmanac verification passed with `uv run pytest -q`
  (`484 passed`), `uv run ruff check .`, and `git diff --check`.
- Slice 38 added `CloudOpenWorkflow`, `DEFAULT_CLOUD_APP_URL`, and public
  browser-handoff commands:
  `codealmanac`, `codealmanac open`, `codealmanac repo setup`, and
  `codealmanac repo open`.
- `tests/test_cloud_open_workflow.py` proves current GitHub checkout URL
  construction, no-browser mode, browser invocation, direct GitHub URLs, and
  unavailable-checkout failures.
- `tests/test_cli.py` proves bare `codealmanac`, `open`, `repo setup`, and
  `repo open` use the current checkout and render human/JSON output.
- `tests/test_architecture.py` proves browser handoff is a workflow boundary
  and that `open` is a top-level parser/dispatch domain.
- Slice 38 full CodeAlmanac verification passed with `uv run pytest -q`
  (`496 passed`), `uv run ruff check .`,
  `uv run python -m compileall src -q`, and `git diff --check`.
- Slice 39 added `codealmanac runs start --branch <branch>`.
- `tests/test_cloud_runs_service.py` proves the cloud runs service uses the
  stored CLI token and calls `POST /v1/repositories/{repo_id}/runs`.
- `tests/test_cloud_runs_workflow.py` proves the workflow resolves the current
  GitHub checkout to a cloud repo before starting the branch run.
- `tests/test_cli.py` proves the public CLI command preserves slash branch
  names and renders the returned cloud run.
- Slice 39 full CodeAlmanac verification passed with `uv run pytest -q`
  (`496 passed`), focused cloud-runs/CLI/architecture tests (`123 passed`),
  `uv run ruff check .`, `uv run python -m compileall src -q`, and
  `git diff --check`.
- Slice 44 added `codealmanac runs cancel <run-id>`.
- `tests/test_cloud_runs_service.py` proves cancellation uses the stored CLI
  token and calls the cloud run cancellation client method.
- `tests/test_cloud_runs_workflow.py` proves cancellation is run-id scoped and
  does not require current-checkout repository resolution.
- `tests/test_cli.py` proves the public CLI command renders a cancelled cloud
  run.
- Slice 44 full CodeAlmanac verification passed with `uv run pytest -q`
  (`496 passed`), focused cloud-runs/CLI/architecture tests (`123 passed`),
  `uv run ruff check .`, `uv run python -m compileall src -q`, and
  `git diff --check`.
- Slice 45 added `codealmanac runs retry <run-id>`.
- `tests/test_cloud_runs_service.py` proves retry uses the stored CLI token and
  calls the cloud run retry client method.
- `tests/test_cloud_runs_workflow.py` proves retry is run-id scoped and does
  not require current-checkout repository resolution.
- `tests/test_cli.py` proves the public CLI command renders the retried cloud
  run.
- Slice 45 full CodeAlmanac verification passed with `uv run pytest -q`
  (`496 passed`), focused cloud-runs/CLI/architecture tests (`123 passed`),
  `uv run ruff check .`, `uv run python -m compileall src -q`, and
  `git diff --check`.

Commands:

```bash
uv run pytest tests/test_cloud_open_workflow.py tests/test_cli.py tests/test_architecture.py -q
uv run pytest tests/test_runs_service.py tests/test_run_queue_workflow.py tests/test_sync_workflow.py tests/test_cli.py tests/test_public_contract.py tests/test_architecture.py -q
uv run pytest
uv run ruff check .
git diff --check
uv run codealmanac --help
uv run codealmanac dev ingest --help
uv run codealmanac dev garden --help
```

## CodeAlmanac Hosted Repo

Must prove:

- Repo rename is reflected in package names, deployment config, and visible UI.
- Browser onboarding covers auth, GitHub App, repo selection, trigger policy,
  delivery mode, and capture consent.
- Per-branch trigger policy includes delivery mode.
- Cloud worker uses the engine contract, not public CLI strings.
- GitHub delivery checks expected HEAD before writing.
- Dashboard pages are backed by explicit API endpoints or GitHub-owned URLs.

Commands:

```bash
make test
make lint
make smoke-backend
make smoke-modal
```

Current evidence:

- Slice 25 created hosted branch `codex/hosted-baseline-convergence` from
  current `origin/main` and pushed commit
  `1d237db chore: rename hosted deploy surfaces`.
- Slice 25 reapplied the rename/deploy-surface changes without replacing the
  newer hosted conversation-sync work already on `origin/main`.
- Changed hosted package/deploy defaults include:
  `.github/workflows/deploy.yml`, `backend/modal_app/runtime.py`,
  `backend/pyproject.toml`, `backend/src/almanac/settings.py`,
  `backend/tests/test_modal_worker_contract.py`, `backend/uv.lock`,
  `frontend/package.json`, and `frontend/package-lock.json`.
- Hosted backend verification on the Slice 25 worktree:
  `uv run pytest` (`290 passed`), `uv run ruff check .`,
  `uv run ruff format --check .`, and
  `uv run pytest tests/test_modal_worker_contract.py` (`9 passed`).
- Hosted frontend verification on the Slice 25 worktree:
  `npm run test:routes` (`26 passed`), `npm run test:frontend`
  (`41 passed`), and `npm run build`.
- This evidence is branch-level. Slice 25 did not promote production
  deployment and did not implement WorkOS/AuthKit, public APIs, or onboarding.
- Slice 26 created hosted branch `codex/workos-authkit-api-foundation` from
  the Slice 25 hosted convergence worktree.
- Slice 26 pushed hosted commit
  `5858ae1 feat: migrate hosted auth to WorkOS`.
- Slice 26 implements WorkOS/AuthKit browser auth, FastAPI WorkOS bearer-token
  verification, and hosted `workos_user_id text` user identity storage.
- Slice 26 removed the active Supabase Auth helper/client path from hosted auth
  wiring while keeping Supabase as the database/migration/storage platform.
- Hosted backend verification on the Slice 26 worktree:
  `uv run pytest tests/test_identity_auth_contract.py tests/test_identity_api_contract.py tests/test_hosted_conversation_sync_contract.py tests/test_store_timestamps_contract.py tests/test_analytics_contract.py -q`
  (`31 passed`),
  `uv run pytest tests/test_architecture_contract.py tests/test_repositories_api_contract.py tests/test_wiki_api_contract.py tests/test_repositories_contract.py tests/test_updates_contract.py tests/test_wiki_contract.py -q`
  (`126 passed`), `uv run pytest` (`286 passed`),
  `uv run ruff check .`, and `uv run ruff format --check .`.
- Hosted frontend verification on the Slice 26 worktree:
  `npm run test:routes` (`26 passed`), `npm run test:frontend`
  (`41 passed`), and `npm run build`.
- Slice 26 build still has the known non-blocking CSS optimizer warning about
  a comment containing `m-* utility`.
- Slice 26 does not implement versioned public API, CLI login/capture
  credentials, onboarding configuration screens, or hosted worker/run storage.
- Slice 30 materialized cloud source-artifact refs in the Modal worker into
  `.codealmanac-worker/sources/<batch-id>/manifest.json` and
  `sessions/<provider>/<provider-session-id>-<hash>.jsonl`.
- `backend/tests/test_modal_worker_contract.py` proves conversation batch runs
  pass the materialized source folder to
  `codealmanac dev ingest <sources-dir> --foreground --using codex`.
- `backend/tests/test_modal_worker_contract.py` proves PR and branch update
  commands use the current Python CodeAlmanac CLI bridge:
  `codealmanac dev ingest github:pr:<n> --foreground --using codex` and
  `codealmanac init --using codex --yes`.
- `backend/tests/test_modal_worker_contract.py` proves the Modal image installs
  Python CodeAlmanac from a pinned git ref and no longer installs the old npm
  package.
- Slice 30 full hosted backend verification passed with `uv run pytest -q`
  (`301 passed, 1 warning`), `uv run ruff check .`,
  `uv run ruff format --check .`, and `git diff --check`.
- Slice 31 added `backend/modal_app/codealmanac_engine.py` as the hosted
  adapter from typed hosted runs to `codealmanac.maintenance`.
- `backend/tests/test_modal_worker_contract.py` proves PR sources map to
  `ingest github:pr:<n>`, conversation batches map to the materialized source
  folder, and branch sources map to `init`.
- `backend/tests/test_modal_worker_contract.py` proves the production update
  worker calls the package API adapter and does not import `modal_app.commands`,
  `run_command`, or `codealmanac_command`.
- `backend/tests/test_architecture_contract.py` proves the `github:pr:` source
  context now lives in the Modal CodeAlmanac engine adapter rather than the
  GitHub integration model layer.
- Slice 31 full hosted backend verification passed with `uv run pytest -q`
  (`303 passed, 1 warning`), `uv run ruff check .`,
  `uv run ruff format --check .`, `python -m compileall backend/src
  backend/modal_app -q`, and `git diff --check`.
- Slice 32 added hosted SQL-backed `run_events` with `(run_id, sequence)`,
  timestamp, event kind, message, and optional normalized payload JSON.
- `backend/tests/test_update_run_events_contract.py` proves ordered run-event
  append/list behavior and migration coverage.
- `backend/tests/test_architecture_contract.py` proves run-event persistence
  remains table/store owned inside the updates package.
- Slice 32 full hosted backend verification passed with `uv run pytest -q`
  (`306 passed, 1 warning`), `uv run ruff check .`,
  `uv run ruff format --check .`, `python -m compileall backend/src
  backend/modal_app -q`, and `git diff --check`.
- Slice 33 added hosted `RunStatus.STALE` for expected-head drift during
  delivery.
- `backend/tests/test_github_git_contract.py` proves Git commit delivery raises
  typed `GitHubBranchHeadChanged` when the branch ref no longer matches the
  expected head.
- `backend/tests/test_updates_contract.py` proves stale delivery marks the run
  `stale`, records no commit, skips billing, skips `RunDelivered`, rejects
  moved open-wiki bases before branch creation, and clears stale conversation
  ingest state.
- `backend/tests/test_update_run_events_contract.py` proves the launch migration
  includes the `stale` run status alongside `run_events`.
- Hosted frontend DTO/status tests prove `stale` is part of the mirrored status
  surface and renders through the shared status metadata/icon path.
- Slice 33 full hosted backend verification passed with `uv run pytest -q`
  (`311 passed, 1 warning`), `uv run ruff check .`,
  `uv run ruff format --check .`, `python -m compileall src modal_app -q`,
  `git diff --check`, `npm run lint`, `npm run test:frontend` (`41 passed`),
  and `npm run test:routes` (`26 passed`).
- Slice 34 exposed persisted hosted run events through
  `GET /api/runs/{run_id}/events` and dashboard row timelines.
- `backend/tests/test_updates_contract.py` proves run-event reads authorize
  through the run's repository before returning events.
- `backend/tests/test_repositories_api_contract.py` proves the new route
  returns the mirrored `RunEventDTO` payload shape.
- `frontend/tests/frontend/gateway.test.ts` proves the BFF allowlist includes
  `GET /api/dashboard/runs/<uuid>/events` while unknown paths remain rejected.
- `frontend/tests/frontend/run-row.test.tsx` proves the dashboard renders event
  kind, message, relative time, and normalized payload fields from
  `RunEventDTO`.
- Slice 34 verification passed with hosted backend focused tests
  (`35 passed, 1 warning`), full hosted backend (`312 passed, 1 warning`),
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `git diff --check`,
  `npm run lint`, `npm run test:frontend` (`43 passed`), and
  `npm run test:routes` (`26 passed`).
- Slice 35 added SQL-backed `repository_trigger_policies`, with RLS policy in
  launch security hardening.
- `backend/tests/test_repositories_contract.py` proves trigger policy writes
  preserve slash-containing branch names and require settings permission.
- `backend/tests/test_repositories_api_contract.py` proves trigger policy list
  and write routes are account scoped and use JSON body branch names.
- `backend/tests/test_updates_contract.py` proves enabled branch-push trigger
  policies start `BranchSource` runs and select `CommitToBranch` vs
  `OpenWikiPullRequest` from delivery mode.
- Slice 62 extends `backend/tests/test_updates_contract.py` to prove
  `.almanac/`-only branch pushes are ignored without policy lookup, mixed
  code/wiki pushes still start runs, truncated payloads do not use visible paths
  as an ignore signal, and delivery messages use `docs almanac:` consistently.
- `frontend/tests/frontend/repository-settings.test.tsx` proves repository
  settings render maintained branches, saved trigger state, and delivery
  controls from DTOs.
- Slice 35 verification passed with hosted backend focused tests
  (`118 passed, 1 warning`), full hosted backend (`320 passed, 1 warning`),
  `uv run ruff check .`, `uv run ruff format --check .`,
  `python -m compileall src modal_app -q`, `git diff --check`,
  `npm run lint`, `npm run test:frontend` (`44 passed`),
  `npm run test:routes` (`26 passed`), and `npm run build`. Build passed with
  the known CSS optimizer warning about `m-* utility`.
- Slice 38 added hosted redirector routes for terminal handoff:
  `/wiki/github/[owner]/[repo]` and `/setup/repo`.
- `frontend/tests/routes.test.mjs` proves CLI-opened URLs resolve through
  `resolveRepositoryByFullName`, redirect into existing account-scoped
  dashboard routes, and use GitHub-owned URLs for repository and GitHub App
  configuration.
- Slice 38 hosted verification passed with backend repo API tests
  (`13 passed, 1 warning`), full hosted backend tests
  (`327 passed, 1 warning`), frontend route tests (`27 passed`),
  `npm run test:frontend` (`44 passed`), `npm run lint`, `npm run build`,
  `uv run ruff check .`, `uv run python -m compileall src modal_app -q`, and
  `git diff --check`. Build passed with the known CSS optimizer warning about
  `m-* utility`.
- Slice 39 added hosted manual branch run start. `Updates.start_branch_run`
  requires `Action.APPROVE_UPDATE`, reads the GitHub branch head, reuses branch
  delivery policy when present, defaults delivery to `commit` otherwise, and
  starts the hosted worker.
- `backend/tests/test_updates_contract.py` proves manual run start permission,
  default commit delivery, configured PR delivery, duplicate-head idempotency,
  and out-of-capacity failure.
- Slice 39 hosted verification passed with backend focused tests
  (`37 passed, 1 warning`), full hosted backend tests
  (`333 passed, 1 warning`), frontend route tests (`27 passed`),
  `npm run lint`, `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Slice 40 added typed `RunFailed` and `RunStale` domain events. `UpdateCompletion`
  dispatches them when a worker fails/blocks or delivery detects a stale branch
  head.
- `backend/tests/test_events_contract.py` proves terminal run events carry
  repo/head facts.
- `backend/tests/test_updates_contract.py` proves failed and stale completions
  dispatch `run_failed` and `run_stale` events after terminal run state is
  written.
- Slice 40 hosted verification passed with focused tests (`108 passed`), full
  hosted backend tests (`334 passed, 1 warning`), `uv run ruff check .`,
  `uv run python -m compileall src modal_app -q`, and `git diff --check`.
- Slice 41 aligned active hosted product identity with `codealmanac-hosted`.
  `CLAUDE.md`, `MANUAL.md`, FastAPI app metadata, logger names, event
  dispatcher session keys, frontend support defaults, and the clean-slate
  Supabase migration comment no longer use active `usealmanac` naming.
- Slice 41 hosted verification passed with backend focused tests
  (`85 passed`), full backend tests (`334 passed, 1 warning`),
  `uv run ruff check .`, `uv run python -m compileall src modal_app -q`,
  frontend route tests (`27 passed`), frontend component tests (`44 passed`),
  `npm run lint`, `npm run build`, and `git diff --check`. The frontend build
  retained the known non-blocking CSS optimizer warning about `m-* utility`.
- Slice 43 aligned hosted setup copy with the cloud-first CLI contract and was
  later superseded by the Python package command in Slice 50. Current public
  setup copy should use `uv tool install codealmanac` and `codealmanac setup`,
  not `npx codealmanac`.
- Slice 43 updated `/cli-login` to use `codealmanac login` for expired login
  links and `CodeAlmanac CLI` in the visible page copy.
- `frontend/tests/routes.test.mjs` proves the setup page, CLI login page, and
  GitHub App install prompt use the new setup vocabulary.
- Slice 43 hosted frontend verification passed with route tests (`27 passed`),
  frontend component tests (`44 passed`), `npm run lint`, `npm run build`, and
  `git diff --check`. The build retained the known non-blocking CSS optimizer
  warning about `m-* utility`.
- Slice 43 pushed hosted commit `eafe60c feat: align cloud setup copy`,
  deployed Vercel production
  `https://codealmanac-hosted-2ld7otxqz-thealmanac.vercel.app`, aliased it to
  `https://www.codealmanac.com`, and verified HTTP 200 from the production URL.
- Slice 42 added typed hosted GitHub Check Run models, resource adapter, and
  `checks` capability backed by GitHub App installation tokens.
- Slice 42 added `GitHubChecksFanout`, subscribing to `RunDelivered`,
  `RunFailed`, and `RunStale` outside the update service.
- `backend/tests/test_github_checks_contract.py` proves the Check Runs REST
  body, endpoint path, installation-token use, and typed response parsing.
- `backend/tests/test_github_checks_fanout.py` proves delivered runs publish
  `success` or `neutral`, failed runs publish `failure`, stale runs publish
  `action_required`, and details URLs point to the existing repository page.
- Slice 42 pushed hosted commit
  `97564f7 feat: publish terminal run checks` and deployed Render service
  `srv-d8g8nb37uimc739vnnsg` at exact commit
  `97564f7ea00c74614f8c45c081430e73bbd38090`; deploy
  `dep-d938q30js32c73eqj80g` finished `live`.
- Slice 42 backend production smoke passed:
  `https://codealmanac-backend-docker.onrender.com/api/health` returned HTTP
  200 with `{"status":"ok"}`.
- Slice 42 hosted verification passed with focused backend tests
  (`114 passed`), full backend tests (`340 passed, 1 warning`),
  `uv run ruff check .`, `uv run python -m compileall src modal_app -q`, and
  `git diff --check`.
- Slice 44 added hosted cloud run cancellation. Queued runs cancel in SQL;
  running runs cancel through the stored Modal function-call id; already
  delivered, failed, or stale runs return conflict.
- `backend/tests/test_updates_contract.py` proves queued cancellation, running
  Modal cancellation, idempotent already-cancelled behavior, terminal conflict,
  missing-worker-call conflict, authorization through `Action.APPROVE_UPDATE`,
  run-event writing, and `run_cancelled` event dispatch.
- `backend/tests/test_cli_runs_api_contract.py` and
  `backend/tests/test_repositories_api_contract.py` prove CLI-token and
  browser-session cancellation routes call the same update service.
- `backend/tests/test_modal_worker_contract.py` proves the Modal adapter calls
  `FunctionCall.from_id(call_id).cancel(terminate_containers=False)`.
- `backend/tests/test_github_checks_fanout.py` proves cancelled runs publish a
  GitHub Check conclusion of `cancelled`.
- Hosted frontend DTO/status tests prove `cancelled` is part of the mirrored
  status set and the BFF allowlist accepts `POST /api/dashboard/runs/<uuid>/cancel`.
- Slice 44 hosted verification passed with focused backend tests
  (`75 passed, 1 warning`), full backend tests (`348 passed, 1 warning`),
  route tests (`27 passed`), frontend component tests (`44 passed`), backend
  ruff/compileall, frontend lint/build, and `git diff --check`.
- Slice 45 added hosted cloud run retry. Retry creates a new run, accepts
  `failed`, `stale`, and `cancelled`, rejects `queued`, `running`, and
  `delivered`, refreshes current GitHub head, and preserves conversation batch
  source refs by reference.
- `backend/tests/test_updates_contract.py` proves branch retry, PR retry,
  conversation-batch retry, duplicate-head suppression, active-run conflict,
  delivered-run conflict, authorization through `Action.APPROVE_UPDATE`, and
  worker start behavior.
- `backend/tests/test_cli_runs_api_contract.py` and
  `backend/tests/test_repositories_api_contract.py` prove CLI-token and
  browser-session retry routes call the same update service.
- Frontend gateway tests prove the BFF allowlist accepts
  `POST /api/dashboard/runs/<uuid>/retry` and rejects wrong methods.
- Slice 45 hosted verification passed with focused backend tests
  (`61 passed, 1 warning`), full backend tests (`355 passed, 1 warning`),
  route tests (`27 passed`), frontend component tests (`44 passed`), backend
  ruff/compileall, frontend lint/build, and `git diff --check`.
- Slice 46 added visible hosted dashboard run actions on repository activity
  rows. Active runs show Cancel; failed, stale, and cancelled runs show Retry;
  delivered runs stay read-only.
- `frontend/src/components/runs/run-actions.ts` proves the action policy has a
  single source, and `frontend/tests/frontend/run-actions.test.ts` pins the
  status-to-action mapping and pending copy.
- `frontend/src/components/runs/runs-list.tsx` calls the existing BFF
  `cancelRun` and `retryRun` commands, replaces cancelled rows, inserts/upserts
  retried runs at the top, and keeps polling limited to visible queued/running
  rows.
- `frontend/tests/frontend/run-row.test.tsx` proves action visibility, pending
  state, and inline error rendering.
- Slice 46 hosted frontend verification passed with route tests (`27 passed`),
  frontend component tests (`50 passed`), `npm run lint`, `npm run build`, and
  `git diff --check`.
- Slice 47 added the repository setup summary on the hosted repository settings
  page. It shows GitHub App access, repository access, browser-user capture
  credential state, maintained branch trigger count, and delivery readiness.
- Slice 47 added browser-authenticated `GET /api/capture/status`, returning
  `CaptureStatusDTO` without raw capture token material.
- `backend/tests/test_capture_tokens_api_contract.py` proves
  `/api/capture/status` uses browser-session auth, not CLI-token auth, and does
  not return raw capture tokens.
- `frontend/tests/frontend/repository-setup-summary.test.tsx` proves the setup
  summary renders connected capture state, GitHub configuration URLs, enabled
  maintained branches, delivery modes, and empty/inactive states.
- `frontend/tests/routes.test.mjs` proves the settings page and server API
  client wire `RepositorySetupSummary`, `CaptureStatusDTO`, and
  `getCaptureStatus()`.
- Slice 47 verification passed with focused backend tests
  (`15 passed, 1 warning`), full backend tests (`356 passed, 1 warning`),
  route tests (`27 passed`), frontend component tests (`52 passed`), backend
  ruff/compileall, frontend lint/build, and `git diff --check`.
- Slice 50 added hosted `/setup` as the browser-owned cloud setup hub. The page
  requires a WorkOS/AuthKit browser session, shows the GitHub App installation
  path when needed, lists connected GitHub accounts when available, and presents
  the Python CLI setup command.
- Slice 51 route guards prove `/setup` keeps the current cloud setup contract:
  it names cloud setup, asks the user to connect GitHub and choose repositories,
  links the GitHub App path, shows `uv tool install codealmanac` followed by
  `codealmanac setup`, links to the local agent access guide, and does not
  mention `npx codealmanac`, `almanac login`, email verification, passwords, or
  magic links.
- Remaining hosted worker risks: authenticated production browser verification,
  setup CTA refinement, provider-library alignment, and provider cleanup still
  need launch-hardening.

## PyPI Release

Must prove:

- `codealmanac` release artifacts build from the release commit.
- Built wheel and sdist pass Twine metadata validation.
- The publish path uses PyPI Trusted Publishing, not a committed PyPI token.
- The PyPI trusted publisher entry exists for the exact GitHub owner, repo,
  workflow filename, and environment.
- Fresh install from PyPI works after publication.

Current evidence:

- Slice 52 replaced the disabled publish workflow with a manual
  trusted-publishing workflow on `.github/workflows/publish.yml`.
- The workflow refuses non-`main` refs, requires `confirm_version` to match
  `pyproject.toml`, refuses pre-release versions, runs pytest/ruff/diff
  hygiene, builds artifacts, validates them with Twine, and publishes through
  `pypa/gh-action-pypi-publish@release/v1`.
- The workflow grants `id-token: write` only in the publish job and uses GitHub
  environment `pypi`, matching the PyPI trusted publisher environment.
- `RELEASE.md` records the exact PyPI trusted publisher setup:
  project `codealmanac`, owner `AlmanacCode`, repository `codealmanac`,
  workflow filename `publish.yml`, environment `pypi`.
- Slice 56 completed the trusted-publishing path. GitHub Actions run
  `28619144624` succeeded on `main` at
  `43ec4800311b2f66f6095bff231f5fde7740eb07`.
- The Slice 56 publish run passed tests, lint, diff hygiene, artifact build,
  Twine checks, artifact upload, and PyPI upload through
  `pypa/gh-action-pypi-publish@release/v1`.
- PyPI now serves `codealmanac` `0.1.0` in the JSON API and simple index; the
  simple index includes provenance links for the `0.1.0` wheel and sdist.
- Fresh install smoke passed with
  `UV_TOOL_DIR=<tmp> UV_TOOL_BIN_DIR=<tmp> uv tool install --python 3.12 codealmanac==0.1.0`;
  the installed executable returned `0.1.0` for `codealmanac --version` and
  exposed the expected public command surface in `codealmanac --help`.

## Provider / Deployment

Must prove:

- Render service points at `codealmanac-hosted`.
- Vercel project points at the renamed repo and `frontend/` root.
- Modal app name no longer uses `usealmanac`.
- Supabase migrations include the shared control tables, cloud-only product
  tables, `run_events`, `deliveries`, and storage refs.
- GitHub App callback/webhook URLs point at the launch domain.
- Doppler, PostHog, and Autumn visible names are consistent with CodeAlmanac.

Current evidence:

- Earlier launch setup renamed the GitHub repo to
  `AlmanacCode/codealmanac-hosted` and updated the local hosted origin.
- Earlier launch setup deployed Modal app `codealmanac-hosted-updates`,
  verified Render health, and verified Vercel serving
  `https://www.codealmanac.com`.
- Slice 25 makes the hosted rename/deploy-surface changes available on a clean
  current-main branch before the WorkOS/AuthKit and public API slices.
- Slice 41 verified GitHub repo `AlmanacCode/codealmanac-hosted`, default
  branch `main`, and clean hosted worktree origin
  `https://github.com/AlmanacCode/codealmanac-hosted.git`.
- Slice 41 renamed Vercel project id `prj_sBOdSIF82roDGnkFeYrh5qdg6epp` from
  `thealmanac/usealmanac` to `thealmanac/codealmanac-hosted` through the
  documented `PATCH /v9/projects/{idOrName}` API. `vercel project inspect
  codealmanac-hosted --scope thealmanac` succeeds; inspecting `usealmanac`
  fails with no project.
- Slice 41 deployed the hosted frontend to production. Vercel build
  `https://codealmanac-hosted-lasush9ur-thealmanac.vercel.app` was aliased to
  `https://www.codealmanac.com`, and `curl` returned HTTP 200.
- Slice 41 deployed Render service `srv-d8g8nb37uimc739vnnsg` at exact commit
  `a781e5189da4403bcf8b31d7fb9129b3779aec01`. Deploy
  `dep-d938j4km0tmc73d6p3sg` finished `live`, and
  `https://codealmanac-backend-docker.onrender.com/api/health` returned HTTP
  200 with `{"status":"ok"}`.
- Slice 42 deployed Render service `srv-d8g8nb37uimc739vnnsg` at exact commit
  `97564f7ea00c74614f8c45c081430e73bbd38090`. Deploy
  `dep-d938q30js32c73eqj80g` finished `live`, and
  `https://codealmanac-backend-docker.onrender.com/api/health` returned HTTP
  200 with `{"status":"ok"}`.
- Slice 41 verified Doppler project `codealmanac` configs
  `dev`, `dev_personal`, `stg`, and `prd`; `codealmanac/prd` has no secret
  names matching `usealmanac` or `USEALMANAC`.
- Slice 41 verified Modal contains deployed `codealmanac-hosted-updates`.
  The old `usealmanac-updates` app is still deployed and should be cleaned up
  only in an explicit provider-retirement step.
- Slice 41 verified `posthog-cli api` is available and that Autumn billing
  verification passes through `make billing-verify` with Doppler
  `codealmanac/dev_personal`. Raw `npm run billing:verify` fails without
  `AUTUMN_SECRET_KEY`, which is expected outside Doppler.
- Slice 43 verified the live GitHub App exposes `checks: write`, `contents:
  write`, and `pull_requests: write`.
- Slice 43 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-2ld7otxqz-thealmanac.vercel.app`, aliased it to
  `https://www.codealmanac.com`, and verified HTTP 200.
- Slice 44 fast-forwarded hosted `main` to
  `0e17a34c56be5e839e01a163bb2ca4ef8cc46fd7` so provider branch tracking uses
  the launch code.
- Slice 44 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-ce944e0r5-thealmanac.vercel.app`, aliased it to
  `https://www.codealmanac.com`, and verified HTTP 200.
- Slice 44 deployed Render service `srv-d8g8nb37uimc739vnnsg` at exact commit
  `0e17a34c56be5e839e01a163bb2ca4ef8cc46fd7`; deploy
  `dep-d93997dosiuc73cd9fig` finished `live`.
- Slice 44 backend production smoke passed:
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated
  `POST /v1/runs/00000000-0000-0000-0000-000000000000/cancel` returned
  `401 not_authenticated`, proving the new cancel route is mounted.
- Slice 45 fast-forwarded hosted `main` to
  `b3535cdfda2cec1633be05fafd0ffd1ec7440e0b` so provider branch tracking uses
  the launch code.
- Slice 45 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-g97a69ujf-thealmanac.vercel.app`, aliased it to
  `https://www.codealmanac.com`, and verified HTTP 200.
- Slice 45 Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact
  commit `b3535cdfda2cec1633be05fafd0ffd1ec7440e0b`; deploy
  `dep-d939gveq1p3s73d1dt30` finished `live`.
- Slice 45 backend production smoke passed:
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated
  `POST /v1/runs/00000000-0000-0000-0000-000000000000/retry` returned
  `401 not_authenticated`, proving the new retry route is mounted.
- Slice 46 fast-forwarded hosted `main` to
  `7b35cc96b4afbacce376bfb4f0feca253b8d44e0` so provider branch tracking uses
  the launch code.
- Slice 46 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-arnwuqgyo-thealmanac.vercel.app`, deployment id
  `dpl_7D22Df6y4Q1D5MM8eqLHnnf2Qekx`; Vercel aliased it to
  `https://www.codealmanac.com` and reported status `Ready`.
- Slice 46 Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact
  commit `7b35cc96b4afbacce376bfb4f0feca253b8d44e0`; deploy
  `dep-d939m5cm0tmc73avfu50` finished `live`.
- Slice 46 production smoke passed:
  `https://www.codealmanac.com` returned HTTP 200 and
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`.
- Slice 47 fast-forwarded hosted `main` to
  `2102d38d17f66c32fb2e68a30ae9ddb3a1f8a34c` so provider branch tracking uses
  the launch code.
- Slice 47 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-3wf3uccd1-thealmanac.vercel.app`, deployment id
  `dpl_DmcaJnx2j1vLBfFHuWFaiCDzUgax`; Vercel aliased it to
  `https://www.codealmanac.com` and reported status `Ready`.
- Slice 47 Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact
  commit `2102d38d17f66c32fb2e68a30ae9ddb3a1f8a34c`; deploy
  `dep-d939qpbtqb8s73fg7c9g` finished `live`.
- Slice 47 production smoke passed:
  `https://www.codealmanac.com` returned HTTP 200,
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated `GET /api/capture/status` returned
  `401 not_authenticated`, proving the new browser capture-status route is
  mounted.
- Slice 48 fast-forwarded hosted `main` to
  `c68d448d87e7d3ffb6f1a239129b1885adf35641` so provider branch tracking uses
  the launch code.
- Slice 48 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-qejqttlne-thealmanac.vercel.app`, deployment id
  `dpl_FNMruMmwmmv2d9xzk7eYkEErsb5j`; Vercel aliased it to
  `https://www.codealmanac.com` and reported status `Ready`.
- Slice 48 Render auto-deployed service `srv-d8g8nb37uimc739vnnsg` at exact
  commit `c68d448d87e7d3ffb6f1a239129b1885adf35641`; deploy
  `dep-d93a2c6k1jcs73ab8qg0` finished `live`.
- Slice 48 production smoke passed:
  `https://www.codealmanac.com` returned HTTP 200,
  `https://codealmanac-backend-docker.onrender.com/api/health` returned
  `{"status":"ok"}`, and unauthenticated `GET /api/capture/status` returned
  `401 not_authenticated`.
- Slice 53 fast-forwarded hosted `main` to
  `8052be030f202b3186cad85b51e12308ca4f9bc4`, matching
  `origin/codex/workos-authkit-api-foundation`.
- Slice 53 did not trigger a deployment because the hosted diff since
  `a8ebe9e` was route-test-only.
- Slice 53 verification passed with hosted route tests (`27 passed`), hosted
  `npm run lint`, `https://www.codealmanac.com` HTTP 200,
  `https://www.codealmanac.com/login` HTTP 200, and
  `https://codealmanac-backend-docker.onrender.com/api/health` returning
  `{"status":"ok"}`.
- Slice 54 triggered CodeAlmanac publish workflow run `28617718053` on
  `main`; it failed in `uv run pytest` because
  `test_runs_service_streams_attach_until_run_is_terminal` exposed a real
  terminal-record/log-event race in local run attach streaming.
- Slice 54 fixed the race in `RunAttachStreamer` and pushed commit
  `a0c86bfe6bedfdd2cd7bd8ff21c252692a6c4eb6` to `origin/dev` and
  `origin/main`.
- Slice 54 local gates after the fix passed: focused run-stream tests
  (`3 passed`), full `uv run pytest` (`497 passed`),
  `uv run ruff check .`, and `git diff --check`.
- Slice 54 triggered CodeAlmanac publish workflow run `28617914312` on
  `main`; the build job passed tests, lint, diff hygiene, artifact build, Twine
  checks, and artifact upload.
- Slice 54 publish run `28617914312` failed only at PyPI token exchange with
  `invalid-publisher`. The OIDC claims were
  `sub=repo:AlmanacCode/codealmanac:environment:pypi`,
  `repository=AlmanacCode/codealmanac`,
  `workflow_ref=AlmanacCode/codealmanac/.github/workflows/publish.yml@refs/heads/main`,
  `ref=refs/heads/main`, and `environment=pypi`.
- Slice 54 confirmed PyPI still exposes only `codealmanac` `0.1.0.dev0`; fresh
  install from PyPI is blocked until the trusted publisher entry matches those
  claims.
- Slice 55 updated hosted `/setup` with a real ordered cloud setup checklist:
  GitHub sign-in, GitHub App installation, repository selection, repository
  automation, and this-machine CLI setup.
- Slice 55 kept top-level setup facts limited to `MeDTO` state and did not
  invent repository count, branch trigger, delivery, or capture status.
- Slice 55 hosted frontend verification passed with route tests (`27 passed`),
  frontend component tests (`52 passed`), frontend lint, and Next build.
- Slice 56 reran CodeAlmanac publish workflow `28619144624` after the PyPI
  trusted publisher entry was added. The run succeeded, and PyPI now serves
  `codealmanac` `0.1.0`.
- Slice 56 verified public installation with
  `UV_TOOL_DIR=<tmp> UV_TOOL_BIN_DIR=<tmp> uv tool install --python 3.12 codealmanac==0.1.0`,
  then ran the installed `codealmanac --version` (`0.1.0`) and
  `codealmanac --help`.
- Slice 55 browser-harness verification proved unauthenticated
  `http://localhost:3000/setup` redirects into the GitHub-only login surface
  with `Continue with GitHub` and no email/password path. The local full dev
  stack could not start because Doppler `codealmanac/dev_personal` is missing
  `GITHUB_TOKEN_ENCRYPTION_KEYS`.
- Slice 55 pushed hosted commit `49afdcebace71eefb45e004c403879aaae6b3e9f` to
  the hosted launch branch and hosted `main`.
- Slice 55 deployed the hosted frontend to Vercel production
  `https://codealmanac-hosted-nhz0fnyqv-thealmanac.vercel.app`, and Vercel
  aliased it to `https://www.codealmanac.com`.
- Slice 55 production smoke passed: `https://www.codealmanac.com` HTTP 200,
  `https://www.codealmanac.com/login` HTTP 200, unauthenticated
  `https://www.codealmanac.com/setup` redirected through WorkOS/AuthKit, and
  backend health returned `{"status":"ok"}`.
- 2026-07-03 production clean-slate reset verified:
  `codealmanac/prd` is the Render production Doppler target, WorkOS production
  user count is `0`, Supabase production hosted-table/auth/storage count query
  returned no nonzero rows, and `supabase db push --linked --dry-run` reported
  `Remote database is up to date.`
- Slice 64 production CLI smoke verified source `uv run codealmanac` against
  `https://api.codealmanac.com`: Chrome approved `/cli-login`, `whoami`
  returned `rohans0509`, setup planning returned `automation_mode: "none"`,
  capture status worked, capture enable created a cloud credential and temp
  Codex hook, and capture disable revoked the credential.
- Slice 64 isolated PyPI check proved `codealmanac==0.1.1` still defaults to
  the Render URL. The repo package was bumped to `0.1.2` with canonical
  defaults `https://api.codealmanac.com` and `https://www.codealmanac.com`.
- Slice 64 publish verification passed: GitHub Actions publish run
  `28648341690` succeeded, PyPI JSON reports latest `0.1.2`, fresh unpinned
  `uv tool install --python 3.12 --refresh --no-cache codealmanac` installed
  `0.1.2`, `capture status --json` reported the canonical API URL, and the
  installed CLI completed Chrome `/cli-login` approval with no `--api-url`.

## Slice 65 Public Installer And README Contract

- `scripts/install.sh` is the source public installer in CodeAlmanac.
- Hosted serves the same installer from `frontend/public/install.sh`, so
  `https://www.codealmanac.com/install.sh` can be a static file.
- The README and hosted onboarding surfaces use
  `curl -fsSL https://www.codealmanac.com/install.sh | sh` as the first public
  install command.
- Manual install remains
  `uv tool install --python 3.12 codealmanac`.
- Hosted frontend `BACKEND_BASE_URL` fallback is now
  `https://api.codealmanac.com`; Render remains a provider deployment detail,
  not a default product URL.
- Installer contract tests prove the script uses Astral `uv`, installs through
  `uv tool install`, does not contain npm/npx install paths, and reports
  existing `codealmanac` PATH shadows.
- Verification passed:
  - `sh -n scripts/install.sh`
  - `sh -n frontend/public/install.sh`
  - byte-for-byte installer comparison
  - `uv run pytest tests/test_public_contract.py -q` (`26 passed`)
  - `uv run pytest -q` (`501 passed`)
  - `uv run ruff check .`
  - hosted `npm run test:routes` (`28 passed`)
  - hosted `npm run test:frontend` (`52 passed`)
  - hosted `npm run lint`
  - hosted `npm run build`
  - temp-dir installer smoke installed `codealmanac==0.1.2` and warned about
    the stale Node-era binary shadowing the installed PyPI tool.
- Deploy and production smoke passed:
  - CodeAlmanac commit `43a88a6e` pushed to `origin/dev` and `origin/main`.
  - Hosted commit `3cb9462` pushed to the hosted feature branch and hosted
    `origin/main`.
  - Vercel production deployment `6RT9PwDsTAicKSHid57JjcmDkubA` is aliased to
    `https://www.codealmanac.com`.
  - `https://www.codealmanac.com/install.sh` returned `HTTP/2 200`,
    `content-type: application/x-sh`, passed `sh -n`, and matched
    `scripts/install.sh` byte-for-byte.
  - Production homepage contains the curl installer twice and contains no
    `npx codealmanac`, `codealmanac-backend-docker`, `vercel.app`, or
    `render.com` strings.
  - `https://api.codealmanac.com/api/health` returned `{"status":"ok"}`.
  - Chrome verified signed-in `/setup` for `rohans0509`: cloud checklist,
    curl installer, connected `AlmanacCode`, and no stale npm or old backend
    host strings.
  - Chrome verified signed-in `/dashboard/local-agent-access`: curl installer,
    `codealmanac setup`, and no `npx`, old backend host, or Vercel URL.
  - Chrome verified source CLI and PyPI CLI `/cli-login` handoffs; both saved
    auth and `whoami` returned `rohans0509` with cloud
    `https://api.codealmanac.com`.

## Slice 66 Capture Upload Production Pressure Test

- Fresh PyPI CLI setup was re-run from a new temp HOME with `--no-browser`.
  Chrome opened the printed production `/cli-login` URL and showed
  `CLI login approved`; the CLI completed as `rohans0509`, and `whoami`
  returned `https://api.codealmanac.com`.
- Production capture credential lifecycle passed:
  - initial `capture status --check-cloud --json`: no local credential, no
    cloud credentials
  - `capture enable --target codex`: credential issued, temp `capture.json`
    mode `0600`, temp Codex Stop hook installed
  - `capture disable --target codex`: credential revoked, temp config removed,
    temp hook file reduced to `{}`
  - final `capture status --check-cloud --json`: no local credential, no hooks,
    no cloud credentials
- Synthetic transcript upload passed through the published CLI's
  `__capture-hook`: `upload_status: uploaded`, repo
  `AlmanacCode/codealmanac`, branch `dev`, and `routing_status: routable`.
- Production internal artifact read-back passed using Render's production
  Doppler target `codealmanac/prd`: `HTTP/2 200`, `122` bytes, SHA-256
  `dd2fe50510ad2cc3a664d840f9e5431e265c6e3d47f6a19ff4f98f3e5b7de32e`.
- Focused local tests passed:
  `uv run pytest tests/test_capture_transcript_upload.py tests/test_cloud_capture_service.py tests/test_cli.py -k capture`
  (`7 passed`).
- Focused hosted tests passed:
  `uv run pytest tests/test_capture_upload_api_contract.py tests/test_capture_tokens_api_contract.py tests/test_internal_route_contract.py`
  (`14 passed`, `1` Starlette warning).

## Slice 67 Branch-Triggered Source Bundles

- Hosted branch pushes now prefer captured conversation source bundles when
  completed ref-backed turns exist for the triggered repo/branch.
- `ConversationBatchSource` still stores refs and `batch_id`; it does not store
  rendered conversation text.
- The branch trigger policy delivery mode now applies to conversation-batch
  runs and branch-source fallback runs.
- The old due-ingest scheduler path also uses branch trigger policy delivery
  instead of hard-coded commit delivery.
- Verification passed:
  - `uv run pytest tests/test_updates_contract.py tests/test_conversation_ingest_scheduler.py -q`
    (`61 passed`)
  - `uv run pytest tests/test_updates_contract.py tests/test_conversation_ingest_scheduler.py tests/test_modal_worker_contract.py tests/test_github_service_contract.py tests/test_installations_contract.py tests/test_architecture_contract.py -q`
    (`172 passed`)
  - `uv run pytest -q` in hosted backend (`380 passed`, `1` Starlette warning)
  - `uv run ruff check .`
  - `python -m compileall backend/src -q`
  - `git diff --check`
- Deploy and production smoke passed:
  - Render deploy `dep-d93oj33rjlhs73abh3tg` is live on hosted commit
    `a9a7ff8` (`feat: trigger source-bundle runs from branch pushes`).
  - `https://api.codealmanac.com/api/health` and the Render service health URL
    returned `{"status":"ok"}`.
  - Fresh published CLI setup through real Chrome approved `/cli-login`, stored
    auth in a temp HOME, and `whoami` returned `rohans0509` with cloud
    `https://api.codealmanac.com`.

## Slice 68 Production Branch Trigger Smoke

- Chrome verified signed-in production `/setup` for `rohans0509` and the
  production repository dashboard for `AlmanacCode/codealmanac`.
- Production GitHub App `push` webhook delivery is enabled.
- Hosted commit `03c57f8` fixed branch pushes incorrectly mapping to first-wiki
  initialization by introducing `InitialWikiSource` and mapping `BranchSource`
  to CodeAlmanac ingest.
- Hosted commit `eb8dba0` fixed branch-source worker checkout determinism:
  branch-like runs now checkout the exact run `head_sha` and fetch
  `before_sha` so `git:range:<before>..<head>` can be evaluated in the Modal
  workspace.
- Verification passed for `eb8dba0`:
  - `uv run pytest tests/test_github_checkout_contract.py tests/test_modal_worker_contract.py -q`
    (`23 passed`)
  - `uv run pytest tests/test_architecture_contract.py tests/test_github_checkout_contract.py tests/test_modal_worker_contract.py tests/test_updates_contract.py tests/test_repositories_api_contract.py tests/test_cli_runs_api_contract.py -q`
    (`165 passed`, `1` Starlette warning)
  - `uv run ruff check src modal_app tests/test_github_checkout_contract.py tests/test_modal_worker_contract.py`
  - real Git fetch-by-SHA smoke for the exact smoke `before_sha` and `head_sha`
- Deploy and production smoke passed:
  - Render deploy `dep-d93pp0eq1p3s73cuomp0` is live on hosted commit
    `eb8dba042c80ed573ad53399f002126d2e14bc29`.
  - Modal app `codealmanac-hosted-updates` was redeployed after the checkout
    fix.
  - Disposable branch push created run
    `773da5fb-9871-4f83-8797-ddf651c635ce` with immutable source range
    `d11d29b96dbfe334b2d9cb99fa5aafcc7893d98a..23a0a03209ff1804944eb094f589647dc13de47b`.
  - The run delivered with summary `No wiki changes made.`
  - Chrome refreshed the production dashboard and showed the delivered run at
    the top.
  - Cleanup completed: smoke trigger disabled, temp capture credential revoked,
    remote smoke branch deleted, temp worktree removed.

Known residue:

- Older failed smoke runs remain visible and should be treated as historical
  evidence.
- Conversation-batch run `aeb55370-cbdd-4ded-af6a-5e0e22f0ef0a` is still
  marked `running` from a stale pre-fix Modal image.

## Slice 69 CLI Open Route Verification

- Installed public CLI `0.1.2` was verified to be the PyPI executable at
  `/Users/rohan/.local/bin/codealmanac`, not the stale Node/npm binary.
- Public `0.1.2` still failed the product route contract:
  `codealmanac open --no-browser` printed the obsolete
  `/wiki/github/AlmanacCode/codealmanac` URL.
- Source `0.1.3` passed the route contract:
  `uv run codealmanac open --no-browser` printed the resolved dashboard wiki
  URL
  `/dashboard/accounts/264516179/repositories/1212149375/wiki`.
- Chrome opened the source `0.1.3` URL and rendered the signed-in repository
  wiki for `AlmanacCode/codealmanac` with `Default branch / 62 pages`.
- Source `0.1.3` setup was re-run with `--yes --json`; it reported
  `already_signed_in`, kept `automation_mode: "none"`, and made no instruction
  file changes because Codex and Claude were already installed.
- Focused tests passed:
  `uv run pytest tests/test_cloud_open_workflow.py tests/test_cli.py -q`
  (`62 passed`).
- Full local gates passed:
  `uv run pytest` (`501 passed`), `uv run ruff check .`, `git diff --check`,
  `uv build --out-dir dist`, and `uvx twine check dist/*`.
- GitHub Actions publish run `28659205416` passed and PyPI accepted
  `codealmanac-0.1.3`.
- Fresh default PyPI install passed:
  `uv tool install --python 3.12 --upgrade --force --refresh codealmanac`
  installed `0.1.3`.
- Installed `codealmanac open` passed the browser contract: it opened Chrome to
  the dashboard wiki URL, not the obsolete `/wiki/github/...` URL, and Chrome
  rendered `AlmanacCode/codealmanac` with `Default branch / 62 pages`.

## Slice 70 Fresh-Install Open Fallback

- Source `0.1.4` preserves both public `open` paths:
  - fresh HOME/no local auth prints
    `https://www.codealmanac.com/wiki/github/AlmanacCode/codealmanac`
  - signed-in HOME prints
    `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/wiki`
- `tests/test_cloud_open_workflow.py` proves only missing `cloud auth state`
  falls back to the public resolver. Other repository resolution failures still
  raise.
- `tests/test_cli.py` proves `codealmanac open --no-browser` succeeds from a
  fresh install without calling the cloud repository client.
- Chrome verified the public resolver path through GitHub OAuth and WorkOS. It
  completed at `/setup` with GitHub connected and no console errors.
- Chrome verified the signed-in dashboard wiki route still renders the
  `AlmanacCode/codealmanac` wiki with `Default branch / 62 pages`.
- Verification passed:
  - `uv run pytest tests/test_cloud_open_workflow.py tests/test_cli.py -q`
    (`65 passed`)
  - `uv run pytest` (`504 passed`)
  - `uv run ruff check .`
  - `git diff --check`
  - `uv build --out-dir dist`
  - `uvx twine check dist/*`
- GitHub Actions publish run `28660115818` succeeded on `main` at
  `35c7108e`, and PyPI now serves `codealmanac` `0.1.4`.
- Fresh public install with
  `uv tool install --python 3.12 --upgrade --force --refresh codealmanac`
  installed `0.1.4`.
- Installed `codealmanac open --no-browser` verified both paths after publish:
  fresh HOME printed the public resolver, and signed-in HOME printed the
  dashboard wiki URL.

## Slice 71 Production Conversation Trigger Smoke

- Published CLI `0.1.4` issued a temporary Codex capture credential from a
  temp HOME and revoked it during cleanup.
- The production capture hook uploaded a synthetic Codex transcript for
  `AlmanacCode/codealmanac` branch
  `codealmanac-smoke/slice-71-20260703123931` with
  `upload_status: uploaded` and `routing_status: routable`.
- The first push created the remote smoke branch and correctly did not trigger
  a run because hosted ignores `event.created`.
- The second push to the existing smoke branch created run
  `02ae5710-92b4-4ae4-acdd-7148e8aa60f7` with source kind
  `conversation_batch`.
- SQL verified source batch `5621c16d-9334-4d8d-8a46-4039b7b2d398`
  succeeded with one turn and the run emitted `queued`, `running`, and
  `delivered` events.
- Public CLI `runs show 02ae5710-92b4-4ae4-acdd-7148e8aa60f7 --json`
  verified terminal status `delivered`, changed file
  `.almanac/pages/github-native-wiki-maintenance.md`, and delivery commit
  `9211b65f85ce0583419926c67968cefc0893c7bd`.
- Chrome verified `/setup`, the repository dashboard, and the repository
  activity page showing the delivered conversation-batch run at the top.
- Cleanup verification passed: no local capture credential, no installed temp
  hooks, no cloud capture credentials, disabled smoke trigger, deleted remote
  smoke branch, removed temp worktree, and removed temp HOME.

## Slice 72 Cloud Setup CLI Polish

- Source root setup is cloud-first:
  `uv run codealmanac setup --yes --skip-login --target codex` rendered the
  bannered `CodeAlmanac setup` output with agent instructions and next commands.
- Source JSON setup no longer leaks scheduler fields:
  `uv run codealmanac setup --yes --skip-login --skip-instructions --json`
  omitted `plan.automation`, `automation_mode`, and `automation_install`.
- Parser/model guardrails keep old root scheduler flags invalid.
- Chrome verified production `/setup` and the repository dashboard as
  `rohans0509`; the setup page showed WorkOS/AuthKit connected, GitHub account
  connected, GitHub repository access, and the CLI setup command.
- Installed public CLI `0.1.4` still authenticated to production:
  `codealmanac whoami` returned `Signed in as rohans0509`.
- Local gates passed:
  - `uv run pytest tests/test_setup_service.py tests/test_cli.py tests/test_architecture.py -q`
    (`133 passed`)
  - `uv run pytest tests/test_public_contract.py -q` (`26 passed`)
  - `uv run pytest -q` (`504 passed`)
  - `uv run ruff check .`
  - `git diff --check`
- Package and release verification passed:
  - `uv build --out-dir dist`
  - `uvx twine check dist/*`
  - GitHub Actions publish run `28662835062` succeeded from `main`
  - PyPI latest JSON reported `0.1.5`
  - fresh isolated `uv tool install --refresh --python 3.12 codealmanac==0.1.5`
    installed the public package
  - installed `codealmanac --version` printed `0.1.5`
  - installed `codealmanac setup --yes --skip-login --skip-instructions --json`
    returned the cloud setup plan without root automation fields

## Slice 73 Hosted Setup Copy

- Hosted frontend production copy now matches the published CLI contract:
  `codealmanac setup` is cloud login plus Codex/Claude instructions, while
  `codealmanac capture enable` is the explicit source-capture step.
- Local verification passed:
  - `npm run test:routes` (`28 passed`)
  - `npm run test:frontend` (`52 passed`)
  - `npm run lint`
  - `npm run build`
- Hosted commit `af0d7da0be82ccc226b2a4a76f58d9e794f71178` is on hosted
  `origin/main`.
- Vercel production deployment
  `https://codealmanac-hosted-g4nbt7h36-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`.
- Chrome verified both `/setup?smoke=slice73` and
  `/dashboard/local-agent-access?smoke=slice73` contain
  `codealmanac capture enable` and do not contain stale setup-capture install
  wording.

## Slice 75 Cloud Repo List

- Hosted `GET /v1/repositories` returns repositories mirrored from GitHub App
  installations visible to the signed-in CLI user.
- The route intentionally does not fan out to per-repository collaborator
  permission checks, avoiding the GitHub user-token rate-limit hot path found in
  Slice 74.
- `codealmanac repo list [--limit N] [--cursor C] [--json]` is the canonical
  public command; `repos` remains intentionally absent.
- Hosted focused tests passed:
  `uv run pytest tests/test_cli_repositories_api_contract.py
  tests/test_repositories_api_contract.py tests/test_core_access_contracts.py
  tests/test_repositories_contract.py`.
- CodeAlmanac full verification passed: `uv run pytest` (`505 passed`), Ruff
  on the touched CLI parser, and `git diff --check`.
- Production API smoke passed:
  `GET https://api.codealmanac.com/v1/repositories?limit=5` returned
  `AlmanacCode/codealmanac`, repo id `1212149375`, account id `264516179`.
- GitHub Actions publish run `28667216307` passed; PyPI accepted
  `codealmanac-0.1.6`.
- Fresh temp install with
  `uv tool install --python 3.12 --upgrade --force --refresh codealmanac`
  installed `0.1.6` and exposed `codealmanac repo list`.
- Chrome verified fresh setup from a clean `HOME`; the hosted
  `/cli-login` page rendered `CLI login approved`, the terminal saved the CLI
  token, and the same clean `HOME` passed `whoami`, `repo list`, `repo status`,
  and `capture status` against production.

## Slice 76 Hosted Repository Settings UX

- Frontend repository-list DTO parity:
  `frontend/src/lib/api/dto/repositories.ts` now mirrors backend
  `RepositoryListItemDTO` with `repoId`, `accountId`, `fullName`, and
  `defaultBranch`.
- Design-lab mock parity:
  `frontend/src/app/design-lab/_experiments/atlas/mock.ts` now satisfies the
  same DTO shape, so preview data cannot teach stale list fields.
- Repository readiness summary:
  missing capture renders `Setup needed`, links to the CLI guide, and says
  `Run codealmanac capture enable after CLI setup`.
- Maintained branch settings:
  each branch row renders branch identity, `Maintained` / `Ignored`, and a
  labelled per-branch delivery selector.
- Local hosted frontend verification passed with bundled Node `v24.14.0`:
  - `npm run test:frontend` (`52 passed`)
  - `npm run test:routes` (`28 passed`)
  - `npm run lint`
  - `npm run build`
  - `git diff --check`
- Hosted commit `bff009bf7181b32a13a89aaf16aa683837207b09` is on hosted
  `origin/main`.
- Vercel production deployment
  `https://codealmanac-hosted-jgak4853w-thealmanac.vercel.app` is aliased to
  `https://www.codealmanac.com`.
- Chrome verified signed-in production repository settings at
  `https://www.codealmanac.com/dashboard/accounts/264516179/repositories/1212149375/settings`.
  The page rendered the new readiness actions, missing-capture CLI handoff,
  per-branch delivery controls, and had no console errors.
