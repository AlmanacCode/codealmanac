# Cloud/Local Parallel Architecture

Date: 2026-07-02.
Status: active design note.

This note records the current architecture direction for making CodeAlmanac
cloud and local feel parallel without turning them into one muddy UX or two
unrelated products.

## Decision

Keep one product architecture with two runtime postures:

```text
cloud posture:
  usealmanac owns teams, GitHub App, billing, dashboard, source capture,
  branch triggers, cloud run records, and GitHub delivery.

local posture:
  codealmanac owns repo-local setup, source discovery from the user's machine,
  local Git hook triggers, local jobs/runs, local harness credentials, and
  Git delivery.

shared posture-neutral layer:
  codealmanac owns the engine contract: source refs, operation request,
  run snapshot, wiki mutation safety, result bundle, and page-writing prompts.
```

The shared layer should be a typed contract, not a human CLI command string.
The cloud worker can still invoke a CLI entrypoint for packaging, but that
entrypoint should be machine-oriented and accept one resolved request.

## Why This Shape

The user-facing products differ.

Cloud sells team/repo wiki automation: GitHub App installation, permissions,
capture consent, branch triggers, managed workers, run history, delivery PRs or
commits, and billing.

Local sells trust and experimentation: a developer can run the same wiki
maintenance brain from a checkout, with their own model credentials, local
agent transcripts, and ordinary Git diffs.

The architecture should not hide that difference. It should make the parallel
parts explicit.

## Parallel Concepts

| Concept | Cloud implementation | Local implementation |
| --- | --- | --- |
| Trigger | GitHub webhook, dashboard action, branch/environment rule | Manual command or local Git hook event on a configured maintained branch |
| Source library | Cloud DB/storage of captured sessions, turns, branch touches, PR data, comments | Local control DB/storage of captured sessions, turns, branch touches, and explicit source refs |
| Source bundle | Selected full sessions and repo/PR/branch context for one cloud run | Selected local files, git refs, transcripts, PR refs, and runtime snapshots for one local job |
| Run snapshot | GitHub checkout at a SHA plus source bundle and settings | Temp worktree or detached checkout at the triggering SHA, plus source bundle and settings |
| Operation | Engine request such as `ingest`, `garden`, or initial build | Same operation names behind local lifecycle commands |
| Execution | Modal/worker calls CodeAlmanac engine with app credentials | Local process calls CodeAlmanac engine with user's credentials |
| Delivery | GitHub commit or PR by policy | Working-tree delivery for manual commands; commit-to-branch with `expected_head_sha` for automatic branch maintenance |
| Run state | Cloud DB/dashboard, including future `run_events` | Local control DB, replacing current repo-local job JSON/JSONL over time |

This is the important one-to-one correspondence: the nouns match even when the
adapters are different.

## Code Boundary

Recommended repo split:

```text
/Users/rohan/Desktop/Projects/codealmanac
  shared engine contract
  local CLI
  local source/runtime adapters
  local hook trigger adapter
  local jobs/runs
  local control DB
  machine worker entrypoint used by cloud
  prompts and wiki mutation safety

/Users/rohan/Desktop/Projects/usealmanac
  cloud control plane
  frontend/dashboard
  auth, identity, GitHub App, repository permissions
  billing and account state
  source capture service
  trigger policy
  cloud run database
  Modal worker orchestration
  GitHub delivery
```

Do not move cloud identity, billing, GitHub installation state, or dashboard code
into `codealmanac`.

Do not fork the wiki-writing brain into `usealmanac`.

The ideal dependency direction is:

```text
usealmanac constructs CloudRunRequest
  -> worker materializes repo checkout and source bundle
  -> codealmanac engine runs EngineRunRequest
  -> worker returns UpdateBundle/WikiChangeBundle
  -> usealmanac delivers through GitHub
```

`usealmanac` should own the policy decision. `codealmanac` should own the engine
execution.

## Current Mismatch To Fix Later

The current cloud worker already has typed cloud models:

```text
Run
  source: PullRequestSource | BranchSource
  delivery: CommitToBranch | OpenWikiPullRequest
```

But it currently converts that typed run back into a human CLI command:

```bash
codealmanac ingest github:pr:8 --foreground --using codex -y
codealmanac init --using codex -y
```

That is the leaky boundary. It makes cloud rediscover context through the local
human command surface.

Target shape:

```bash
codealmanac __run-engine --request /work/run-request.json --result /work/result.json
```

The name can change. The important part is that this is a machine entrypoint over
a typed request, not the cloud pretending to be a human running local commands.

## Shared Engine Request

The engine request should be posture-neutral:

```python
class EngineRunRequest:
    run_id: str
    operation: Literal["build", "ingest", "garden"]
    workspace: WorkspaceSnapshot
    sources: SourceBundle
    delivery_mode: Literal["produce_bundle"]
    harness: HarnessSelection
    guidance: str | None

class WorkspaceSnapshot:
    repo_root: str
    almanac_root: str
    branch: str | None
    head_sha: str | None
    dirty: bool
    dirty_summary: list[str]

class SourceBundle:
    trigger: TriggerRecord
    refs: list[SourceRef]
    runtime_snapshots: list[SourceRuntime]

class EngineRunResult:
    status: Literal["succeeded", "failed"]
    summary: str
    files_changed: list[str]
    commit_subject: str | None
    commit_body: str | None
```

Cloud can fill this from GitHub and its source library. Local can fill this from
the checkout, local transcripts, `gh`, and explicit paths.

When `files_changed` is non-empty, the engine prompt should ask the agent to
produce a specific `commit_subject` and optional `commit_body`. Delivery owns
the final commit format in both cloud and local:

```text
almanac: <commit_subject>
```

## Cloud Adapter

Cloud flow:

```python
trigger = usealmanac.github.receive(webhook)
decision = usealmanac.updates.decide(trigger, repo_settings, billing, access)

if decision.starts_run:
    run = usealmanac.updates.create_run(decision.source, decision.delivery)
    worker.start(run.id)

worker:
    checkout = github.checkout(run.source)
    bundle = source_library.select(run.source, run.trigger)
    request = engine_request.from_cloud(run, checkout, bundle)
    result = codealmanac.engine.run(request)
    post_completion(result)

usealmanac.updates.complete(result)
usealmanac.delivery.apply(result, run.delivery)
```

Cloud controls when to run and where the result lands. The engine controls how
the wiki is updated.

## Local Adapter

Local flow:

```python
request = local_cli.parse("codealmanac local ingest github:pr:8")
workspace = local.workspace.snapshot(cwd)
sources = local.sources.resolve(request.inputs, workspace)
job = local.jobs.start(operation="ingest", workspace=workspace, sources=sources)
engine_request = engine_request.from_local(job, workspace, sources)
result = codealmanac.engine.run(engine_request)
local.delivery.apply_working_tree(result)
local.jobs.finish(job, result)
```

Local controls when to run and where the result lands. The engine controls how
the wiki is updated.

## Naming

Use the same internal nouns across both postures:

| Internal noun | Meaning |
| --- | --- |
| `Trigger` | Something happened that may justify wiki maintenance. |
| `SourceLibrary` | Durable pool of source evidence. Cloud has a real one; local starts with discovery plus a ledger. |
| `SourceBundle` | Source evidence selected for one run/job. |
| `RunSnapshot` | Repo/wiki/source state frozen enough for one execution. |
| `Operation` | What the engine is doing: build, ingest, garden. |
| `EngineRunRequest` | The resolved input to the wiki-writing brain. |
| `WikiChangeBundle` | Delivery-neutral set of wiki file changes. |
| `DeliveryTarget` | Where the changes should land. |

Public names can differ by audience. Cloud can say `runs`; local can say `jobs`
because local users are inspecting machine work. Internally, both can still
share a run/execution model.

## CLI Implication

Top-level `codealmanac setup` should remain cloud-first.

Local should sit under an explicit namespace:

```bash
codealmanac setup
codealmanac status
codealmanac capture status
codealmanac runs list
codealmanac repos list

codealmanac local setup
codealmanac local ingest <sources...>
codealmanac local sync
codealmanac local garden
codealmanac local jobs
codealmanac local triggers
codealmanac local status
```

Do not add local commands only for perfect symmetry. Keep local commands where
they represent real local lifecycle work.

Do not add cloud commands only because local has them. Cloud commands should map
to actual cloud product capabilities.

## What To Avoid

Avoid two engines:

```text
cloud engine in usealmanac
local engine in codealmanac
```

That creates drift and weakens the open-core story.

Avoid one giant repo:

```text
codealmanac also owns dashboard, billing, GitHub App, Modal, Supabase
```

That makes the OSS package carry hosted control-plane concerns.

Avoid human CLI as the worker API:

```text
worker shells out to `codealmanac ingest github:pr:8`
```

That is acceptable as a temporary compatibility bridge, but it is not the
architecture.

## Migration Path

1. Keep the current local Python CLI working.
2. Add shared typed engine request/result models inside `codealmanac`.
3. Add a private machine entrypoint that runs an engine request and emits a
   result bundle.
4. Update local `ingest`, `garden`, and `sync` to build the same request shape
   before calling the engine.
5. Update `usealmanac` worker to pass a typed request instead of a human command.
6. Keep GitHub delivery in `usealmanac`; keep working-tree delivery in
   `codealmanac`.
7. Move public CLI words after the architecture seam exists:
   `setup` becomes cloud setup, existing local lifecycle commands move under
   `local`.

## Open Questions

- Should local use current-checkout execution forever, or move to temp worktrees
  once run snapshots become first-class?
- Should the shared result be named `UpdateBundle`, `WikiChangeBundle`, or
  `EngineResult`?
- Should internal storage keep `Run` as the one word everywhere, while local
  public CLI says `jobs`?
- Should `sync` become a local trigger/source-selection command only, while
  cloud uses `capture` plus branch triggers?
- How much of the cloud source library should have a local analogue, versus
  keeping local as discovery plus ledger?

## Current Recommendation

Build the shared engine request/result seam first.

Do not decide the whole cloud/local UX by command names. The durable decision is
that cloud and local both produce the same engine input and consume the same
delivery-neutral wiki change bundle.

Once that seam exists, the UX can be clean:

```text
cloud: polished control plane over the same engine
local: explicit developer namespace over the same engine
```
