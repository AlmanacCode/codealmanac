# Target Architecture

This is a partially implemented target. Slice 81 implemented the
`codealmanac.cloud` package boundary. Slice 82 implemented the
`codealmanac.wiki` package boundary. Slice 83 implemented the first
`codealmanac.engine` package boundary. Slice 84 implemented the
`codealmanac.local` package boundary. The broader hosted package refactor is
still proposed.

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
  control/                # user-level local control DB
  hooks/                  # local Git hook installation/status
  delivery/
    ledger/               # delivery records in the local control DB
    execution/            # deterministic local Git delivery workflow
  runs/
    artifacts/            # model-worker run artifacts
    preparation/          # snapshot/source bundle preparation
    execution/            # local engine invocation workflow
    jobs/                 # local run/job list and inspection
    worker/               # detached local worker entrypoint
  policies/               # local branch trigger and delivery policy
  setup/                  # explicit local setup flow
  status/                 # local status aggregation
  update/                 # local update execution workflow
```

Implemented in Slice 84. This groups the old `services/control`,
`services/deliveries`, `services/engine_runs`, `services/local_hooks`, and
`workflows/local_*` control-plane concepts. The older repo-local lifecycle
`services/runs` / `workflows/run_queue` concept still exists and should be
collapsed deliberately in the later local run-name slice, not hidden in a
package move.

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
  harnesses/
  sources/
  source_bundles/
  worker_workspaces/
  page_run/
  lifecycle/
```

Implemented in Slice 83 for harness contracts, source refs/runtimes, source
bundle materialization, worker workspaces, shared page-run execution, and
lifecycle safety helpers. Packaged `prompts/` and `manual/` still live at the
root package level until a distribution-aware resource move is worth doing.

The hosted Modal worker imports from here. The human CLI is not the engine
contract.

### `jobs/`

Jobs own repo-local lifecycle execution records and the single-writer
background queue.

```text
jobs/
  ledger/
  queue/
```

Implemented in Slice 85. `jobs/ledger/` owns `JobRecord`, `JobLogEvent`,
`JobSpec`, `JobStore`, and `JobLedgerService`. `jobs/queue/` owns
`JobQueueWorkflow`. This package replaces the old repo-local lifecycle
`services/runs` and `workflows/run_queue` names. It does not replace
`cloud/runs/` or `local/runs/`, which represent trigger-created runs.

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
- repo-local lifecycle execution is `jobs`; cloud/local trigger execution is
  `runs`.
