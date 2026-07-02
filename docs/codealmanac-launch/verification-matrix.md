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

Commands:

```bash
uv run pytest
uv run ruff check .
git diff --check
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

## Provider / Deployment

Must prove:

- Render service points at `codealmanac-hosted`.
- Vercel project points at the renamed repo and `frontend/` root.
- Modal app name no longer uses `usealmanac`.
- Supabase migrations include the shared control tables, cloud-only product
  tables, `run_events`, `deliveries`, and storage refs.
- GitHub App callback/webhook URLs point at the launch domain.
- Doppler, PostHog, and Autumn visible names are consistent with CodeAlmanac.
