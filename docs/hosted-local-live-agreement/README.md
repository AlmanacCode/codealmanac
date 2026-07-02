# Cloud And Local CodeAlmanac Live Agreement

Status: active design agreement.
Started: 2026-06-30.
Anchor session: Codex thread `019f19ac-8db5-7631-a8d7-93540285bdb1`.

This document records the current agreement for how local CodeAlmanac and a
future cloud CodeAlmanac should fit together. It does not change
`docs/python-port-live-agreement.md`: the active Python v1 remains local-only
until a later implementation plan explicitly changes scope.

Terminology update, 2026-07-01: use **cloud**, not **hosted**, for the paid
managed product. Older linked notes still use "hosted" because they are
historical discussion records.

Related prior notes:

- `docs/cli-hosted-redesign-2026-06-27/README.md`
- `docs/cli-hosted-redesign-2026-06-27/delivery-model.md`
- `docs/cli-hosted-redesign-2026-06-27/product-boundary-notes.md`
- `docs/plans/2026-06-02-hosted-github-app-architecture.md`
- `docs/hosted-local-live-agreement/mem0-comparison-2026-06-30.md`
- `docs/hosted-local-live-agreement/firecrawl-comparison-2026-06-30.md`
- `docs/hosted-local-live-agreement/mem0-architecture-and-codealmanac-implications-2026-07-01.md`
- `docs/hosted-local-live-agreement/cloud-first-product-agreement-2026-07-01.md`
- `docs/hosted-local-live-agreement/cloud-local-difference-map-2026-07-01.md`
- `docs/hosted-local-live-agreement/mem0-two-product-rationale-2026-07-01.md`
- `docs/hosted-local-live-agreement/local-cli-future-2026-07-01.md`
- `docs/hosted-local-live-agreement/cloud-local-parallel-architecture-2026-07-02.md`
- `docs/hosted-local-live-agreement/cloud-local-state-mirror-2026-07-02.md`
- `docs/hosted-local-live-agreement/local-pipeline-architecture-2026-07-02.md`
- `docs/hosted-local-live-agreement/cli-onboarding-launch-2026-07-02.md`
- `docs/plans/2026-07-02-codealmanac-cloud-local-launch.md`

## Core Agreement

CodeAlmanac remains repo-native. The canonical wiki lives in the repository
under the configured Almanac root. Cloud infrastructure may keep copies,
indexes, source records, run logs, and dashboard state, but it should deliver
wiki changes back into Git.

Cloud is the default product experience. Most users should install/connect the
cloud product first, because cloud gives the best UX: GitHub App setup, team
state, source capture, background workers, run history, and PR/commit delivery.
Local remains a real opt-in path for users who want a free, inspectable,
offline-capable, repo-local workflow.

Local and cloud should share the same artifact and update engine shape. They
differ in who collects sources, who runs compute, who owns credentials, and how
the resulting wiki diff is delivered.

The wiki is slow-moving context. Coding-agent conversations, branch activity,
commits, PR discussion, and other raw evidence are fast-moving context. The
wiki should update at a finalization event, not on every turn.

For v1 cloud source collection, AI coding conversations are the primary source
class. Code changes and commit ranges are also part of the update context.
Other source classes can be added later through the same source-collection
boundary.

SDK and MCP are not near-term product surfaces. The current interface question
is CLI plus cloud dashboard/GitHub App. MCP or SDK should be deferred until
there is a concrete agent or integration use case that the CLI/cloud API cannot
serve cleanly.

## Working Flow

```text
trigger / environment change
  -> collect relevant source sessions
  -> materialize a source bundle
  -> run the CodeAlmanac update operation in a worker/container
  -> deliver the wiki diff by policy
```

The worker/container runs the Python CodeAlmanac system. Cloud passes the repo
checkout, operation request, commit or branch context, and a source folder by
reference. The worker should not rediscover product policy from a human CLI
command string.

Default execution posture:

```text
cloud by default
local only when explicitly requested with --local or a local-specific command
```

The CLI may offer `--cloud` for explicitness, but cloud is the default where a
command can sensibly talk to the cloud.

## Triggers And Environments

The current working idea is that triggers are configured around branch-backed
environments. A repo can choose `main`, `dev`, or another branch as an
environment. A change to that environment can trigger a maintenance run.

Open naming question: `environment` may be the right product word, because the
branch is acting like a deployment environment. `watched branch` may be clearer
for the first implementation. The concept should stay per-repo.

The most important trigger is a merge or commit into the canonical branch. A
repo may also choose a less-final branch such as `dev` if that is where durable
project state becomes meaningful.

The internal concept is a **finalization event**. A finalization event means
"enough has happened that the slow-moving wiki may need to change." In cloud,
the cleanest finalization event is usually a GitHub event such as a PR merge
into a maintained branch or a direct commit to that branch. A PR being opened or
updated can surface useful context, but it should not force a wiki update by
default unless a repo explicitly chooses that policy.

Local and cloud finalization events are different because local Git state and
GitHub state are different. Local can observe working tree changes, local
commits, local merges, or local Git hook events. Cloud observes GitHub webhooks,
branches, pull requests, commits, checks, and installation permissions.

Current local trigger decision: no time-based local scheduling for the branch
maintenance path. Local should use Git hook dispatchers such as `post-commit`,
`post-merge`, and `post-rewrite`; the dispatcher records a trigger only when
the current branch is configured as maintained for that repo. Git hooks are
repo-level, so branch selectivity is a CodeAlmanac control-DB/config check, not
a Git feature.

## Source Selection

Cloud needs a mapping from AI conversation turns to repo branches. The mapping
is not the source text itself; it is an index for deciding which full sessions
to include in a run.

Working data model:

```text
user_account
  id
  user_id
  account_id

account
  id
  name

repo
  id
  account_id
  provider_repo_id
  name

branch_or_environment
  id
  repo_id
  name

session
  id
  provider
  provider_session_id
  stored_source_ref

turn
  id
  session_id
  provider_turn_id
  created_at

turn_branch
  turn_id
  branch_id
```

A branch belongs to one repo. A repo has many branches. A session has many
turns. A turn can touch many branches, and a branch can be touched by many
turns, so `turn_branch` is many-to-many.

The branch ID should be globally unique, or at least unique enough that
`main` in repo A and `main` in repo B cannot collide.

## Full-Session Rule

Branch attribution selects sessions. It does not slice the prompt into only the
matching turns.

Selection shape:

```text
branch id
  -> turn_branch rows
  -> touched turns
  -> touched sessions
  -> full session files
```

The model receives the entire selected session as a file in the source bundle.
It may inspect the full conversation to understand the relevant part. We should
not store an intelligent cursor such as "last useful injected turn" or build a
partial-context system unless there is later evidence that full-session source
files fail.

This is a product rule, not only a storage detail: the agent is trusted to read
the source file and decide what matters.

## Provider Branch Extraction

Each provider needs an extraction function that maps a turn to candidate branch
IDs.

Working contract:

```python
def detect_turn_branches(turn: NormalizedTurn) -> list[BranchTouch]:
    ...
```

For Codex v1, use the session-wide or turn-level branch metadata that Codex
already exposes, even if it is imperfect. For Claude Code v1, build the
equivalent adapter from the available transcript or hook metadata.

The seam matters more than v1 accuracy. Later work can improve this function by
using richer provider events, tool calls, `git` state, repo path evidence, or
explicit hook metadata without changing the rest of the pipeline.

## Source Bundle

Cloud accumulates a **source library** over time. The source library is the
stored pool of captured sessions, turn metadata, branch mappings, commits, PR
comments, issue comments, and other evidence that may matter later.

A **source bundle** is different. It is the subset of the source library chosen
for one run after a finalization event. The bundle contains full selected
sessions and any run-specific repo, PR, branch, or commit context needed by the
update operation.

Working shape:

```text
sources/
  conversations/
    codex/<session-id>.jsonl
    claude/<session-id>.jsonl
  git/
    trigger.json
    commits.json
  manifest.json
```

The exact file layout is not settled. The stable requirement is that the worker
receives source material by reference as a folder, not as a giant inline prompt.

## Delivery

Delivery is a policy decision, not worker logic. A repo or environment should
be able to choose how cloud writes the resulting wiki diff:

- commit to the maintained branch after the triggering event
- open a follow-up PR targeting the maintained branch
- update an open PR branch, if that policy is explicitly enabled
- commit to a dedicated Almanac update branch
- no delivery yet, if the run is only a preview/check

The current preference is to support both direct commit and PR delivery, with
the default selected at repo or environment level.

For cloud, the most natural default after a PR merge into `main` or `dev` is
either a follow-up PR or a direct commit to the maintained branch. Updating the
still-open product PR is a separate policy because it changes the author's PR
while it is under review.

For local, delivery is not GitHub-native unless the user adds that behavior.
For manual local commands, the normal delivery target can remain the working
tree. For automatic branch maintenance, the local delivery target should be a
Git commit to the maintained branch guarded by `expected_head_sha`. If the
branch head has changed before delivery, mark the run stale/cancelled, do not
apply the stale wiki diff, and enqueue a new trigger for the newer head. A local
merge and a GitHub PR merge are different events and should not share the same
delivery code path by accident.

## CLI Product Shape

There are three CLI use cases:

- local read/query of the repo-owned wiki
- cloud setup and inspection
- local-lab execution for people who want to run updates on their machine

Local querying should keep reading the wiki from the repository checkout. It
should not proxy normal `search`, `show`, or `serve` reads through cloud APIs.

Cloud can keep a copy or index for dashboard speed and remote browsing, but
the committed repo wiki remains the shared artifact.

The CLI setup flow should be cloud-first:

```bash
codealmanac setup        # cloud walkthrough by default
codealmanac local setup  # local-only setup
```

Conversation capture should never be installed silently during package
installation. It can be a visible step inside `codealmanac setup` / browser
onboarding, and it can also have explicit repair/status commands.

```bash
codealmanac capture status
codealmanac capture repair
```

The exact command names are not final. The agreement is that `capture`, not
`agents`, is the product noun for conversation capture.

## The Seamlessness Problem

The hard product problem is not reading. Read commands can stay coherent because
they read the repo-owned wiki from the current checkout.

The hard problem is writing and automation. The same user-facing noun can mean
different infrastructure:

```text
codealmanac runs
  local:   show local workflow runs stored under local repo/user state
  cloud:   show cloud control-plane runs from the server

codealmanac sync / update
  local:   react to configured local Git hook triggers or explicit commands
  cloud:   react to GitHub branch/environment triggers

conversation capture
  local:   continuous local capture into local control state/storage
  cloud:   continuous cloud capture into cloud APIs/storage
```

This creates a split-attention risk. The open-source local product gives
credibility because it is easy to install and inspect. The cloud product earns
revenue because it runs automation, source capture, and delivery for a team. If
the command model forks, the project starts maintaining two products instead of
one artifact with two execution postures.

The current local product is light: install the CLI and use it against a repo.
There is no required external database, service stack, or cloud account for the
read path. A heavy self-hosted product would ask users to run the same kind of
infrastructure that cloud runs: database, API server, workers, dashboard, auth,
and background jobs.

The open design question is whether CodeAlmanac should keep the OSS path light
or introduce a heavier self-hosted/control-plane path that mirrors cloud.

The user concern on 2026-06-30: "local lab plus cloud" may still mean
maintaining two products. If the local write/automation path is a light local
workflow and cloud write/automation is a server-side GitHub control plane,
they share nouns but not infrastructure. This may be worse for maintainers than
an explicitly heavy self-hosted product, even though heavy self-hosting raises
adoption friction.

The current comparison set suggests this split:

| Company | OSS shape | Cloud shape | CLI/MCP posture |
| --- | --- | --- | --- |
| Mem0 | light embedded `Memory()` library plus heavy self-hosted server | cloud memory API and dashboard | CLI is API/backend oriented; cloud by default, self-hosted via base URL |
| Firecrawl | heavy self-hosted API/server stack | cloud API with proprietary infra | CLI/MCP are clients to cloud or self-hosted API URL |
| CodeAlmanac today | light repo-local CLI | proposed cloud GitHub maintenance layer | CLI is currently the product engine, not just a client |

The hard question is whether CodeAlmanac wants to become Firecrawl-shaped:

```text
shared clients
  -> cloud API
  -> self-hosted API
```

or stay light:

```text
repo-local CLI product
  + cloud maintenance service
```

The Firecrawl-shaped model is cleaner for implementation coherence. The light
model is cleaner for open-source adoption.

## Possible Posture Model

One CLI can stay coherent if commands expose product verbs and the active
posture chooses the backend:

```text
reader
  search / show / serve
  reads repo files
  no account or daemon

local lab
  runs / sync / garden / update
  local transcripts, local model credentials, local run ledger
  writes working tree or optional local commit

cloud
  runs / repos / agents / sources / settings
  cloud source capture, GitHub triggers, cloud workers
  delivers commits or PRs through GitHub
```

The naming must make the posture visible. A command that silently switches from
local files to cloud state is confusing. A command that always answers from a
named posture is easier to reason about:

```text
codealmanac runs                 # current posture
codealmanac runs --local          # force local
codealmanac runs --cloud          # force cloud
codealmanac status                # show posture, repo, account, root, triggers
```

This is not an implementation decision yet. It is the shape of the product
problem.

## Guardrails

- Do not make cloud the canonical wiki store for code repositories.
- Do not trigger wiki updates from every captured turn by default.
- Do not turn turn-to-branch attribution into a hidden summarization system.
- Do not split local and cloud into two incompatible products.
- Do not add cloud implementation to the current Python local v1 without a new
  plan and explicit scope change.

## Open Questions

1. Should the user-facing word be `environment`, `watched branch`, or something
   else?
2. When a feature branch merges into `dev` or `main`, should source selection
   include sessions touching only the source branch, only the target branch, or
   both recursively through merge ancestry?
3. Where do raw sessions live: database rows, object storage, Supabase Storage,
   GitHub artifacts, or a hybrid?
4. What is the retention and deletion policy for uploaded AI conversations?
5. What is the exact source bundle manifest schema?
6. What delivery default should cloud choose for `main`, `dev`, PR branches,
   and forked PRs?
7. Should the environment config live in cloud settings only, repo config only,
   or both with clear precedence?
8. What should the cloud repository be called if `usealmanac` is renamed or
   split later?
9. Should OSS stay a light local CLI, or should there be an official heavy
   self-hosted control plane?
10. If one command exists in both local and cloud postures, should it default
    to the current posture, require an explicit `--local` / `--cloud`, or split
    into separate namespaces?
11. Should cloud conversation capture be available without local-lab capture,
    or does one agent hook installer need to support both modes?
12. Should `runs` mean every run visible to the user across local and cloud, or
    only the active posture's runs?
13. Should local manual commands and automatic branch-maintenance commands share
    one delivery policy, or should manual commands keep working-tree delivery
    while branch triggers use commit delivery?
