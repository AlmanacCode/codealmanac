# Schema And Storage Contract

Status: active.
Date: 2026-07-02.

This file is the launch contract for CodeAlmanac local state and
CodeAlmanac-hosted cloud state.

## Principles

- Query/index state is separate from product/control state.
- Local control state lives under the user's CodeAlmanac home.
- Cloud control state lives in Supabase/Postgres.
- Local stores only what a one-user local runtime needs.
- Cloud stores account, team, installation, billing, webhook, and dashboard
  state.
- Table names should match across local and cloud when they represent the same
  concept.
- Raw bulky artifacts live in files/object storage and are referenced from SQL.
- Cross-wiki links are sunset and should not be extended.
- Source and run artifacts are passed by reference. Tables store ids, paths,
  storage keys, and artifact refs. They do not store full copied conversation
  sessions or source bundles as inline value payloads.

Slice 29 adds the first hosted source-artifact ref path:

```text
conversation_sources.source_ref
```

The capture-token path stores raw transcript bytes in the source-artifact store
and stores `source_ref` plus routing metadata in SQL. It does not write
conversation message content into `conversation_messages`.

Slice 30 makes cloud conversation update runs ref-backed:

```text
runs.source_json.source_refs[]
```

`ConversationBatchSource` contains `batch_id` and source artifact refs. It does
not contain rendered conversation markdown, transcript text, or copied session
payloads. The hosted worker reads refs through the internal artifact edge and
materializes a temporary worker-local folder:

```text
<checkout>/.codealmanac-worker/sources/<batch-id>/
  manifest.json
  sessions/<provider>/<provider-session-id>-<sha-prefix>.jsonl
```

That folder is an execution input, not durable product state. Durable state is
the SQL batch/run rows plus source-artifact refs.

## Local Storage

Local control DB:

```text
~/.codealmanac/control.sqlite
```

Local source artifacts:

```text
~/.codealmanac/sources/
  sessions/
    codex/<session-id>.jsonl
    claude/<session-id>.jsonl
```

Local run artifacts:

```text
~/.codealmanac/runs/<run-id>/
  request.json
  result.json
  wiki.patch
  artifacts/
```

Local lifecycle job state:

```text
~/.codealmanac/jobs/<workspace-id>/
  <run-id>.json
  <run-id>.jsonl
  <run-id>.spec.json
  worker.lock/
  sync-ledger.json
```

Local worker workspaces:

```text
~/.codealmanac/workspaces/<run-id>/
  repo/
  sources/
    manifest.json
    sessions/
  run/
```

Repo-local `<almanac-root>/jobs/` files are legacy lifecycle job state. New
job records, event logs, queued specs, worker locks, and sync ledgers belong in
`~/.codealmanac/jobs/<workspace-id>/`, with read compatibility for older
repo-local files.

## Local Query DB

The local query DB is rebuildable read/search state for the committed wiki.
It is not the source of truth for runs, sources, triggers, or delivery.

Launch query/index tables:

```text
pages
topics
page_topics
topic_parents
file_refs
page_sources
wikilinks
fts_pages
index_metadata
```

Existing `cross_wiki_links` tables may remain only as migration/compatibility
baggage. Do not build new behavior on them.

## Shared Control Tables

These tables exist in both local and cloud where the concept applies.

```text
repositories
branches
repository_trigger_policies   # cloud Slice 35: stored maintained-branch policy
sessions
turns
turn_branches
trigger_events
runs
run_events
deliveries
```

### `repositories`

Local meaning: local checkout plus remote identity.

Cloud meaning: GitHub repository granted through the GitHub App.

Important fields:

```text
id
provider
provider_repo_id
owner_login
owner_type
name
full_name
default_branch
almanac_root
local_root_path        # local only
created_at
updated_at
```

### `branches`

A branch belongs to one repository. This table also carries branch-level trigger
and delivery policy.

User-facing noun: `triggers`.

Cloud implementation note: Slice 35 does not mirror the full branch inventory
into SQL. The cloud settings page reads live branch names from GitHub and stores
only configured maintained-branch policy rows in
`repository_trigger_policies`.

Important fields:

```text
id
repository_id
name
trigger_enabled
delivery_mode          # pr | commit | working_tree, constrained by runtime
last_seen_head_sha
last_triggered_head_sha
created_at
updated_at
```

Cloud delivery modes:

```text
pr
commit
```

Local delivery modes:

```text
working_tree
commit
```

### `repository_trigger_policies`

Cloud table for maintained-branch policy.

Important fields:

```text
repo_id
branch
enabled
delivery_mode          # commit | pr
created_at
updated_at
```

Primary key:

```text
(repo_id, branch)
```

Branch names are data, not URL structure. API writes send `branch` in the JSON
body so names such as `release/1.4` do not require path parsing.

### `sessions`

Stores full-session source identity. It does not store only selected turns as
the source of truth.

Important fields:

```text
id
provider               # codex | claude
provider_session_id
source_ref             # file path or object storage ref
started_at
ended_at
created_at
updated_at
```

### `turns`

Stores turn metadata for source selection.

Important fields:

```text
id
session_id
provider_turn_id
sequence
created_at
metadata_json
```

### `turn_branches`

Join table between turns and branches.

Important fields:

```text
turn_id
branch_id
confidence
detector
created_at
```

### `trigger_events`

Records a finalization event that may start a run.

Important fields:

```text
id
repository_id
branch_id
kind                   # cloud_webhook | local_post_commit | local_post_merge | local_post_rewrite | manual
head_sha
previous_head_sha
payload_ref
status                 # pending | claimed | ignored | superseded
created_at
claimed_at
```

### `runs`

Queryable run-level state. This replaces local repo-level job JSON over time
and parallels cloud run rows.

Important fields:

```text
id
repository_id
branch_id
trigger_event_id
operation              # update, plus internal engine operation if needed
status                 # queued | running | succeeded | failed | stale | cancelled
expected_head_sha
source_bundle_ref
request_ref
result_ref
summary
commit_subject
commit_body
error
started_at
finished_at
created_at
updated_at
```

Use `succeeded` for run success. Do not use `changed` as a run status. Whether
files changed is derived from result/delivery data.

### `run_events`

Ordered normalized event log for a run.

Important fields:

```text
id
run_id
sequence
timestamp
kind                   # status | message | tool | output | error
message
actor
normalized_event_json
raw_event_ref
```

### `deliveries`

Delivery is separate from `runs`. A run can succeed with no delivery, fail
during delivery, or become stale before delivery.

Important fields:

```text
id
run_id
mode                   # pr | commit | working_tree
status                 # pending | succeeded | failed | skipped
target_ref
expected_head_sha
delivered_head_sha
commit_sha
pr_url
summary
error
created_at
updated_at
finished_at
```

Delivery must check the expected head before writing. If the branch moved,
the delivery is skipped, the run becomes `stale`, and a new trigger should be
created for the current head. Repository and branch identity are reached through
the delivery's `run_id`.

## Cloud-Only Tables

CodeAlmanac-hosted additionally needs cloud product tables.

```text
users
accounts
memberships
github_installations
webhook_deliveries
billing_customers / billing mirrors as required by Autumn integration
```

Notes:

- Autumn remains the billing source of truth where possible.
- Billing mirrors should store only the product state needed for dashboard,
  gating, and reconciliation.
- `webhook_deliveries` is cloud-only because local does not receive GitHub
  webhooks.
- Local does not need `users`, `accounts`, `memberships`, or
  `github_installations`.

## Cloud Object Storage

Cloud uses Supabase Storage or equivalent object storage for bulky artifacts.

Launch buckets:

```text
source-artifacts
run-artifacts
```

`source-artifacts` stores captured sessions, source bundles, webhook payloads
when needed, and other input evidence.

Current hosted development storage uses a filesystem-backed artifact store under
`/tmp/codealmanac-source-artifacts` through the same service seam. Production can
replace that adapter with Supabase Storage without changing capture routes.

`run-artifacts` stores engine requests, engine results, patches, raw provider
events, and large worker logs.

SQL tables store refs to these objects; they do not inline large raw payloads.

## Local Versus Cloud Summary

| Concept | Local | Cloud |
| --- | --- | --- |
| Query/search DB | Rebuildable local index | Hosted wiki reader/index tables |
| Control DB | `~/.codealmanac/control.sqlite` | Supabase/Postgres |
| Source artifacts | `~/.codealmanac/sources/` | `source-artifacts` bucket |
| Run artifacts | `~/.codealmanac/runs/` | `run-artifacts` bucket |
| Worker workspace | `~/.codealmanac/workspaces/<run-id>/` | `/work/<run-id>/` or worker temp dir |
| Users/accounts | none | cloud-only |
| GitHub App installations | none | cloud-only |
| Webhooks | none | cloud-only |
| Billing | none | cloud-only |
| Runs | `runs` + `run_events` | `runs` + `run_events` |
| Delivery | `deliveries` | `deliveries` |
