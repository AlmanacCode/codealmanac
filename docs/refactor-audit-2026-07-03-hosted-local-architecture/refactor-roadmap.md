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

Goal:

```text
almanac -> codealmanac_hosted
modal_app -> codealmanac_hosted/worker
server -> codealmanac_hosted/web
```

This is high blast radius but mostly mechanical.

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

Goal:

```text
services/cloud_* + workflows/cloud_* -> cloud/
services/wiki/index/search/pages/topics/viewer/workspaces -> wiki/
services/source_bundles/sources/harnesses/worker_workspaces + lifecycle workflows -> engine/
control/deliveries/local_hooks/local_* workflows -> local/
```

Do this with import-move tooling and thin compatibility only inside the same slice. Delete compatibility modules before the slice lands if all imports are moved.

Remaining work in this slice family:

- `services/source_bundles/sources/harnesses/worker_workspaces + lifecycle workflows -> engine/`
- `control/deliveries/local_hooks/local_* workflows -> local/`

## Slice F: Collapse Local Run Names

Goal:

Replace:

```text
runs
engine_runs
local_runs
local_jobs
run_queue
local_worker
worker_workspaces
```

with clearer responsibilities:

```text
local/runs
engine/runs
engine/workspaces
```

This slice should include a before/after CLI and DB table map.

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
