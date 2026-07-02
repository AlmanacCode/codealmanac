# Verification Matrix

Status: active.

## Auth / API

Must prove:

- WorkOS/AuthKit is the cloud identity provider.
- `codealmanac login` opens browser/device auth, stores local auth under
  `~/.codealmanac/`, and `codealmanac whoami` succeeds from a fresh shell.
- Public API routes verify WorkOS-backed credentials.
- Auth, capture, run-start, and wiki-read endpoints return `429` with
  `Retry-After` under configured abuse tests.
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
- Remaining hosted worker risks: cloud run cancel/retry and richer production
  setup/onboarding screens still need launch-hardening.

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
