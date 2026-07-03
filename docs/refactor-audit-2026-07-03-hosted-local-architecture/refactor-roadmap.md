# Refactor Roadmap

The refactor should happen after product-critical flows are working and deployed. It should still be done before the code calcifies.

## Slice A: Lock Product Nouns

Write a short naming map and apply it everywhere in docs first.

Must settle:

- `trigger`
- `source_bundle`
- `run`
- `run_event`
- `delivery`
- `wiki`
- `worker`
- `cloud`
- `local`

Do not start broad moves until this map is stable.

## Slice B: Hosted Package Rename and Edge Split

Status: partially complete.

Goal:

```text
almanac -> codealmanac_hosted
modal_app -> codealmanac_hosted/worker
server -> codealmanac_hosted/web
```

This is high blast radius but mostly mechanical.

Completed in Slice 87:

- `backend/src/almanac/` -> `backend/src/codealmanac_hosted/`
- `backend/modal_app/` -> `backend/src/codealmanac_hosted/worker/`
- Render and Modal deploy surfaces point at `codealmanac_hosted`

Remaining:

- decide whether the FastAPI edge should stay `server/` or become `web/`
- if it becomes `web/`, do it as a separate behavior-preserving edge rename
  after the package rename has settled

Tests:

- backend full pytest
- ruff
- compileall
- Render health smoke
- Modal deploy smoke
- frontend build if API imports generated values

## Slice C: Hosted `updates` Split

Goal:

```text
services/updates ->
  domains/triggers
  domains/sources
  domains/runs
  domains/delivery
```

Do this after the package rename, not before, to avoid moving the same files twice.

Use a Unit of Work if one API/webhook action writes multiple tables together.

## Slice D: Hosted Events Rename

Goal:

```text
messages + wiring/fanout -> events
```

Keep handlers boring:

```python
events.publish(GitHubInstallationRepositoriesChanged(...))
events.publish(UserSignedUp(...))
```

The event bus should coordinate side effects. It should not hide product policy.

## Slice E: Local Product-Area Repackaging

Status: partially started.

Completed:

- Slice 81: `services/cloud_* + workflows/cloud_* -> cloud/`
- Slice 82: `services/wiki`, `services/workspaces`, `services/index`,
  `services/search`, `services/pages`, `services/topics`, `services/health`,
  and `services/viewer` -> `wiki/`
- Slice 83: `services/source_bundles`, `services/sources`,
  `services/harnesses`, `services/engine_workspaces`, `workflows/page_run`,
  and shared lifecycle helpers -> `engine/`
- Slice 84: `services/control`, `services/deliveries`,
  `services/engine_runs`, `services/local_hooks`, and `workflows/local_*`
  control-plane workflows -> `local/`
- Slice 85: repo-local lifecycle `services/runs` and `workflows/run_queue` ->
  `jobs/ledger` and `jobs/queue`

Goal:

```text
services/cloud_* + workflows/cloud_* -> cloud/                              # done
services/wiki/index/search/pages/topics/viewer/workspaces -> wiki/          # done
services/source_bundles/sources/harnesses + lifecycle workflows -> engine/  # done
local/runs/artifacts + engine/worker_workspaces -> engine/runs + engine/workspaces  # done
control/deliveries/local_hooks/local_* workflows -> local/                  # done
repo-local lifecycle services/runs + workflows/run_queue -> jobs/           # done
```

Do this with import-move tooling and thin compatibility only inside the same slice. Delete compatibility modules before the slice lands if all imports are moved.

Remaining work in this slice family:

- optional later package-resource move for root `prompts/` and `manual/` if
  hosted needs those under `engine/`
- optional later collapse of old repo-local job/run ledger names into the new
  local/engine package language

## Slice F: Collapse Remaining Local Run Names

Goal:

Replace:

```text
runs
local_runs
local_jobs
local_worker
```

with clearer responsibilities:

```text
local/runs
engine/runs
engine/workspaces
```

This slice should include a before/after CLI and DB table map.

Status: partially reduced by Slice 85. Repo-local lifecycle jobs no longer use
the run noun. Remaining cleanup is only for names that still blur branch-
triggered local runs, engine run artifacts, workers, and workspaces.

## Slice G: Database Cleanup

Hosted:

- collapse migrations because there are no real users to preserve;
- rename tables/columns to product nouns;
- store runs and run_events with blob refs for bulky artifacts;
- drop stale legacy columns.

Local:

- move local run metadata out of repo `.almanac/jobs` if that is still the decided direction;
- keep query/index DB separate from control DB;
- do not store cloud-only account/team state locally.
