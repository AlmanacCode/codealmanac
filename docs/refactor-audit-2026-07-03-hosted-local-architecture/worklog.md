# Worklog

## 2026-07-03

- Confirmed `codealmanac` has a wide flat service/workflow shape that obscures the product model.
- Confirmed `codealmanac-hosted` still uses package name `almanac`.
- Confirmed hosted Modal worker source lives in top-level `backend/modal_app`.
- Confirmed hosted `updates` package contains branch policy, bundle materialization, queueing, worker invocation, cancellation, completion, retry, and delivery.
- Confirmed local `control/store.py` is the largest local file at more than 1000 lines.
- Confirmed hosted `conversations/store.py` is the largest hosted backend file at nearly 700 lines.
- Corrected Vercel deployment target earlier in the run: production now points at project `thealmanac/codealmanac-hosted` and serves `https://www.codealmanac.com`.
- Corrected hosted Modal worker pin earlier in the run: `codealmanac-hosted-updates` now installs `codealmanac` from current git SHA and image logs showed `codealmanac 0.1.9`.
- Planned and implemented Slice 81 in `docs/plans/2026-07-03-slice-81-codealmanac-cloud-package.md`.
- Moved the local package's cloud-facing client surface from scattered `services/cloud_*` and `workflows/cloud_*` modules into first-class `src/codealmanac/cloud/`.
- Added architecture coverage so the old cloud service/workflow source files cannot reappear and the new `cloud/` package stays behind the integration boundary.
- Verified Slice 81 with `uv run ruff check src tests` and `uv run pytest -q --tb=short` (`509 passed`).
- Planned and implemented Slice 82 in `docs/plans/2026-07-03-slice-82-codealmanac-wiki-package.md`.
- Moved repo-wiki/read-model code into first-class `src/codealmanac/wiki/`: wiki files, workspaces, index, search, pages, topics, health, and viewer.
- Removed the ambiguous root `wiki/topics.py` facade because it conflicted with the new `wiki/topics/` command package; callers now import topic-file helpers directly.
- Added architecture coverage so the old wiki/read-model `services/` source files cannot reappear and the new `wiki/` package stays behind the integration boundary.
- Verified Slice 82 with `uv run ruff check src tests`, `uv run pytest -q --tb=short` (`510 passed`), and `git diff --check`.
- Planned and implemented Slice 83 in `docs/plans/2026-07-03-slice-83-codealmanac-engine-package.md`.
- Moved the reusable agent/wiki-update runtime into first-class `src/codealmanac/engine/`: harness contracts, source refs/runtimes, source bundle materialization, worker workspaces, shared page-run execution, and lifecycle safety helpers.
- Left packaged `prompts/` and `manual/` at root package level because those are distribution resources and should move only in a separate package-data-aware slice.
- Added architecture coverage so the old engine service/workflow source files cannot reappear and the new `engine/` package stays behind the integration boundary.
- Focused Slice 83 verification passed with the engine/provider/lifecycle test set (`194 passed`).
- Full Slice 83 verification passed with `uv run ruff check src tests`, `uv run pytest -q --tb=short` (`511 passed`), and `git diff --check`.
- Planned and implemented Slice 84 in `docs/plans/2026-07-03-slice-84-codealmanac-local-package.md`.
- Moved the local control plane into first-class `src/codealmanac/local/`:
  control DB, hooks, delivery ledger/execution, run artifacts/preparation/execution/jobs/worker,
  policies, setup, status, and update.
- Added a `CodeAlmanacLocal` composition-root facade so local concepts have one
  explicit home while old top-level app fields remain available during the
  cleanup run.
- Added architecture coverage so the old local service/workflow source files
  cannot reappear.
- Focused Slice 84 verification passed with the local/control-plane test set
  (`131 passed`).
- Full Slice 84 verification passed with `uv run ruff check src tests`,
  `uv run pytest -q --tb=short` (`513 passed`), and `git diff --check`.
- Planned and implemented Slice 85 in
  `docs/plans/2026-07-03-slice-85-job-ledger-naming.md`.
- Moved repo-local lifecycle job storage into `src/codealmanac/jobs/ledger/`
  and the background lifecycle queue into `src/codealmanac/jobs/queue/`.
- Renamed the lifecycle ledger contract from run-shaped names to job-shaped
  names: `JobRecord`, `JobLogEvent`, `JobSpec`, `JobLedgerService`, `JobStore`,
  and `job_id`.
- Kept cloud runs and branch-triggered local runs under `cloud/runs/` and
  `local/runs/`; Slice 85 deliberately did not flatten that product distinction.
- Added `engine/run_ids.py` so engine run artifacts have an engine-owned ID
  type instead of importing local control-plane IDs.
- Focused Slice 85 verification passed with the lifecycle job, sync, viewer,
  server, CLI, and architecture test set (`217 passed`).
- Full Slice 85 verification passed with `uv run ruff check src tests`,
  `uv run pytest -q --tb=short` (`513 passed`), and `git diff --check`.
