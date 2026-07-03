# Target Architecture

This is a partially implemented target. Slice 81 implemented the
`codealmanac.cloud` package boundary. Slice 82 implemented the
`codealmanac.wiki` package boundary. The broader local/engine and hosted
package refactors are still proposed.

## Shared Product Model

Both local and cloud should make these nouns visible:

```text
trigger
source_bundle
run
delivery
wiki
```

The parallel is conceptual. The databases and integrations should not be forced to match when local does not need cloud-only state.

## `codealmanac` Target Shape

Recommended direction:

```text
src/codealmanac/
  app.py                  # composition root
  cli/                    # terminal edge
  cloud/                  # hosted API client flows
  local/                  # local control plane
  wiki/                   # repo wiki model, index, search, pages, topics, viewer
  engine/                 # shared update engine, prompts, source bundles, harnesses
  integrations/           # git, filesystem, browser, agent hooks, schedulers, subprocesses
  db/                     # shared SQLite helpers
  core/                   # tiny shared values/errors
```

### `cloud/`

This is not cloud backend code. It is the local package's client surface for CodeAlmanac Cloud.

```text
cloud/
  auth/
  capture/
  open/
  repositories/
  runs/
  status/
```

Implemented in Slice 81. This replaced scattered `services/cloud_*` plus
`workflows/cloud_*` source modules with one first-class cloud client package.

### `local/`

Local owns the user-level control DB and local automation shape.

```text
local/
  control/
  triggers/
  runs/
  delivery/
  hooks/
  status/
  setup/
```

`local/runs` should own local run lifecycle. It should absorb or clearly relate the current `engine_runs`, `local_runs`, `local_jobs`, and `run_queue` concepts.

### `wiki/`

Wiki owns repo-local markdown and read/query behavior.

```text
wiki/
  workspaces/
  pages/
  topics/
  index/
  search/
  health/
  viewer/
```

Implemented in Slice 82. This groups the old `services/wiki`,
`services/workspaces`, `services/index`, `services/search`, `services/pages`,
`services/topics`, `services/health`, and `services/viewer` concepts.

### `engine/`

Engine owns the work a model/agent performs.

```text
engine/
  prompts/
  manual/
  harnesses/
  sources/
  source_bundles/
  worker_workspaces/
  lifecycle/
```

The hosted Modal worker imports from here. The human CLI is not the engine contract.

## `codealmanac-hosted` Target Shape

Recommended direction:

```text
backend/src/codealmanac_hosted/
  app.py                  # composition root
  settings.py
  web/                    # FastAPI edge
  worker/                 # Modal edge
  domains/                # product use cases
  events/                 # event bus and handlers
  integrations/           # providers
  db/                     # SQLModel, sessions, migrations helpers
  core/                   # shared values/errors
```

### `web/`

```text
web/
  routes/
  dto/
  deps.py
  errors.py
```

Routes parse HTTP, authorize, call domains, and return DTOs. They should not decide product workflows.

### `worker/`

Move `backend/modal_app` into the package:

```text
worker/
  modal_runtime.py
  update_worker.py
  codealmanac_engine.py
  github_delivery.py
  source_artifacts.py
  callback.py
  dev.py
```

The Modal worker is an edge like `web`, not a random top-level app.

### `domains/`

```text
domains/
  identity/
  repositories/
  conversations/
  sources/
  triggers/
  runs/
  delivery/
  wiki/
  billing/
  analytics/
```

This splits hosted `updates` into named responsibilities:

- `triggers`: webhook/finalization policy and branch rules.
- `sources`: source artifact refs and source bundle selection.
- `runs`: run rows, run events, status, cancellation, completion.
- `delivery`: commit/PR delivery policy and application.

### `events/`

```text
events/
  bus.py
  models.py
  handlers/
```

This replaces the fuzzy `messages` plus `wiring/fanout` shape. GitHub webhooks are external events. Product events such as `UserSignedUp` are internal events.

### `integrations/`

```text
integrations/
  github/
  workos/
  modal/
  autumn/
  posthog/
  doppler/
```

Provider clients live here. Product policy does not.

## Naming Rule

If a name can mean two things, it is not good enough.

Examples:

- `updates` should become `runs`, `triggers`, `delivery`, and `sources`.
- `messages` should become `events` or `github_webhooks`, depending on the actual responsibility.
- `modal_app` should become `worker`.
- `cloud_auth` in local should become `cloud/auth`, because it is a cloud client feature.
