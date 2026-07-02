# CodeAlmanac Cloud/Local Launch Plan

Date: 2026-07-02.
Status: planning.
Primary repos:

- `/Users/rohan/Desktop/Projects/codealmanac`
- `/Users/rohan/Desktop/Projects/usealmanac`, to become `codealmanac-hosted`

## Goal

Make CodeAlmanac feel like one product with two runtimes:

```text
codealmanac
  local/open-source engine, CLI, local control DB, local hooks, local worker

codealmanac-hosted
  cloud product, dashboard, GitHub App, teams, billing, cloud runs, delivery
```

Cloud is the default product. Local is a real free/dev runtime with parallel
nouns and execution shape, not a separate conceptual product.

## Launch Decisions

- Use **cloud** in product language.
- Rename `usealmanac` to `codealmanac-hosted`.
- Use one product name: CodeAlmanac.
- Keep the canonical wiki in the repo.
- Keep the query DB separate from product/control state.
- Sunset cross-wiki links in local and cloud.
- Use branch finalization events, not time-based scheduling, for local branch
  maintenance.
- Use Git hooks locally: `post-commit`, `post-merge`, and `post-rewrite`.
- Use launch workspaces: a detached Git worktree plus sibling `sources/` and `run/`
  folders.
- Keep delivery deterministic. The agent writes wiki files in the workspace;
  publisher code applies and commits the resulting wiki diff.
- Use commit subject format:

```text
docs almanac: <summary>
```

## Target Shape

### `codealmanac`

`codealmanac` owns the local runtime and the shared update engine.

It should contain:

- the human CLI
- local setup
- local capture storage
- local trigger hooks
- local control DB at `~/.codealmanac/control.sqlite`
- local query DB for wiki search/read
- local worker workspace creation
- source bundle materialization
- engine request/result models
- deterministic local delivery

It should not contain:

- GitHub App installation flow
- teams/accounts/billing
- cloud dashboard
- Render/Vercel/Modal deployment code
- cloud-only auth policy

### `codealmanac-hosted`

`codealmanac-hosted` owns the cloud product.

It should contain:

- web dashboard
- backend API
- GitHub App webhooks and installation state
- team/account permissions
- billing
- cloud source capture API
- branch trigger configuration
- cloud run queue
- `runs` and `run_events`
- cloud worker orchestration
- delivery by PR or commit
- deployment config for Render, Vercel, Modal, Supabase, Doppler, PostHog, and
  Autumn

It should call the shared engine boundary from `codealmanac`; it should not
fork the wiki-writing algorithm into a second product-specific pipeline.

## Shared Contract

The shared boundary should be a machine contract, not a human CLI string.

```text
EngineRunRequest
  repo_path
  sources_path
  run_path
  repo_id
  branch_id
  branch_name
  expected_head_sha
  operation
  almanac_root
  commit_subject_style = "docs almanac: <summary>"

EngineRunResult
  status
  summary
  commit_subject
  commit_body
  changed_files
  events_ref
  error
```

Cloud can invoke this through an importable Python API or a private machine
entrypoint. The human CLI should remain product UX; the worker contract should
remain stable for automation.

The model container and workers should use the underlying service/API layer or
private engine entrypoint. They should not use the public CLI directly. The CLI
is a thin user-facing client on top of the same engine contract.

## Local Launch Flow

```text
Git hook fires
  -> codealmanac hook trigger ...
  -> control DB records trigger_events row
  -> worker claims repo/branch lease
  -> source selector builds sources/
  -> detached worktree is created at expected_head_sha
  -> engine updates wiki in workspace repo/
  -> publisher collects wiki patch
  -> publisher checks current branch still equals expected_head_sha
  -> publisher applies patch to real checkout
  -> publisher commits "docs almanac: <summary>"
```

Local workspace:

```text
~/.codealmanac/workspaces/<run-id>/
  repo/
  sources/
  run/
    request.json
    result.json
    wiki.patch
```

Local control DB tables:

```text
repositories
branches
sessions
turns
turn_branches
trigger_events
runs
run_events
deliveries
```

Local should not store cloud-only account/team/billing tables.

## Cloud Launch Flow

```text
GitHub webhook fires
  -> backend validates installation/repo/branch policy
  -> backend records trigger_events row
  -> source selector chooses full sessions and repo evidence
  -> worker receives repo/, sources/, run/request.json
  -> engine updates wiki in worker repo/
  -> worker uploads run artifacts and result
  -> backend delivers by configured policy
  -> dashboard shows run_events, delivery, and resulting commit/PR
```

Cloud worker workspace:

```text
/work/<run-id>/
  repo/
  sources/
  run/
    request.json
    result.json
    wiki.patch
```

Cloud has the same core product tables where the concept is the same:

```text
repositories
branches
sessions
turns
turn_branches
trigger_events
runs
run_events
deliveries
```

Cloud also has cloud-only tables:

```text
users
accounts
memberships
installations
billing state
webhook deliveries
auth/session state
```

## Rename Plan

Do not start the rename from the current dirty `usealmanac` checkout.

1. Create a clean branch or clean worktree for the rename.
2. Rename GitHub repo:

```text
AlmanacCode/usealmanac -> AlmanacCode/codealmanac-hosted
```

3. Rename local folder after the branch is clean:

```text
/Users/rohan/Desktop/Projects/usealmanac
  -> /Users/rohan/Desktop/Projects/codealmanac-hosted
```

4. Update Git remotes to the new GitHub URL.
5. Update package/project names:

```text
frontend/package.json              usealmanac -> codealmanac-hosted
backend/pyproject.toml             usealmanac-backend -> codealmanac-hosted-backend
backend/src/almanac/settings.py    usealmanac-updates -> codealmanac-hosted-updates
```

6. Keep existing already-renamed cloud infrastructure where valid:

```text
render.yaml service name: codealmanac-backend
render.yaml Doppler project: codealmanac
Makefile Doppler project: codealmanac
smoke DB name: codealmanac
```

7. Search and classify remaining `usealmanac` names before bulk replacement.
   Some are product names to change; some are old URLs or migration history that
   should stay as historical notes.

## Deployment Migration Checklist

### Render

- Verify repo connection points to `AlmanacCode/codealmanac-hosted`.
- Keep service name `codealmanac-backend` unless Render already has dependent
  dashboards/scripts using a different name.
- Verify Dockerfile path, health check, and Doppler env.

### Vercel

- Rename or recreate the frontend project as CodeAlmanac hosted frontend.
- Point Vercel to the renamed repo and `frontend/` root.
- Update production, preview, and local callback URLs where auth depends on the
  domain.
- Keep `frontend/vercel.json` as the frontend project config.

### Modal

- Rename app from `usealmanac-updates` to `codealmanac-hosted-updates`.
- Verify worker entrypoint after the engine boundary changes.
- Keep cloud worker as orchestrator, not as a forked wiki algorithm.

### Supabase

- Add migrations for source capture, trigger events, run events, deliveries,
  and object refs.
- Add or verify storage buckets for source bundles and run artifacts.
- Update redirect/callback URLs if auth URLs change.

### GitHub App

- Update callback URL and webhook URL.
- Verify permissions still cover contents, pull requests, metadata, and checks
  if checks are used.
- Verify installation-to-account mapping after repo rename.

### Doppler, PostHog, Autumn

- Keep Doppler project `codealmanac` if it is already canonical.
- Search env vars for `USEALMANAC` or `usealmanac`.
- Rename visible product/project labels where they leak to users.
- Do not mutate billing provider state without an explicit provider-mutation
  command.

## Implementation Slices

### Slice 1: Freeze Contracts

Files:

- `docs/hosted-local-live-agreement/*`
- `docs/plans/2026-07-02-codealmanac-cloud-local-launch.md`

Work:

- Finalize nouns: trigger, source bundle, run, run event, delivery.
- Confirm local control DB tables.
- Confirm cloud tables that use the same names.
- Confirm launch worktree delivery.

Verification:

```bash
git diff --check
```

### Slice 2: Shared Engine Contract In `codealmanac`

Likely files:

- `src/codealmanac/app.py`
- `src/codealmanac/services/runs/`
- `src/codealmanac/workflows/`
- new `src/codealmanac/services/engine/`

Work:

- Add request/result models.
- Add an importable engine API or private machine entrypoint for workers.
- Add source bundle input contract.
- Make existing local operations emit `commit_subject` and `commit_body`.
- Normalize run status names: `queued`, `running`, `succeeded`, `failed`,
  `stale`, `cancelled`.
- Verify that worker/cloud integration plans do not call the human CLI as their
  stable contract.

Verification:

```bash
uv run pytest
git diff --check
```

### Slice 3: Local Control DB And Hooks

Likely files:

- new `src/codealmanac/services/control/`
- local setup command files
- hook/capture command files
- `src/codealmanac/services/runs/`

Work:

- Add `~/.codealmanac/control.sqlite`.
- Move or bridge local runs from file ledger to control DB.
- Add hook dispatcher command.
- Add branch-maintenance config.
- Add per repo/branch run lease.

Verification:

```bash
uv run pytest
codealmanac local status
```

### Slice 4: Local Worktree Worker And Delivery

Likely files:

- `src/codealmanac/services/workspaces/`
- `src/codealmanac/services/runs/`
- new delivery module

Work:

- Create detached worktree at `expected_head_sha`.
- Materialize sibling `sources/`.
- Collect wiki diff with Git.
- Refuse delivery if branch HEAD changed.
- Commit with `almanac: <summary>`.

Verification:

```bash
uv run pytest
git log -1 --pretty=%s
```

### Slice 5: Rename `usealmanac` To `codealmanac-hosted`

Likely files:

- `frontend/package.json`
- `backend/pyproject.toml`
- `backend/src/almanac/settings.py`
- `render.yaml`
- `frontend/vercel.json`
- repo README/docs/scripts/env examples

Work:

- Perform repo/folder/remote rename from a clean branch.
- Rename package/project labels.
- Update deploy provider links.
- Keep old names only where they are historical migration references.

Verification:

```bash
make test
make lint
make smoke-backend
```

### Slice 6: Cloud Tables, Source Capture, And Worker Parity

Likely files:

- `backend/supabase/migrations/`
- `backend/src/almanac/services/updates/`
- `backend/modal_app/`
- dashboard run/source pages

Work:

- Add cloud `run_events`.
- Add source-capture storage and session/turn branch attribution.
- Make worker materialize `repo/`, `sources/`, and `run/`.
- Replace current worker command shape with the shared engine contract.
- Keep GitHub delivery deterministic with expected-head checks.

### Slice 7: CLI Auto-Update

Likely files:

- `src/codealmanac/services/updates/`
- `src/codealmanac/integrations/updates/`
- `src/codealmanac/cli/parser/updates.py`
- `src/codealmanac/cli/dispatch/updates.py`

Work:

- Research existing Python CLI auto-update libraries before writing custom
  updater code.
- Choose an updater that can run after or around the current command without
  replacing the running process.
- Keep `codealmanac update` as an explicit repair/debug command.
- Make normal CLI invocations auto-update without prompting.

Verification:

```bash
uv run pytest
git diff --check
```

Verification:

```bash
make test-backend
make smoke-modal
make test-frontend
```

## Open Decisions

- Whether the cloud worker imports `codealmanac` as a package or shells out to a
  private machine entrypoint.
- Exact first local CLI surface after `codealmanac local setup`.
- Whether local capture is enabled during local setup or a separate explicit
  capture setup step.
- Whether cloud launch delivery defaults to PR or direct commit per maintained
  branch.
- Exact storage path for local source objects under `~/.codealmanac/`.

## Non-Goals

- Do not build an SDK or MCP for launch unless the launch product needs it.
- Do not mirror cloud accounts/billing into the local DB.
- Do not add time-based local branch maintenance.
- Do not let the agent perform delivery merges.
- Do not keep building new cross-wiki-link behavior.
