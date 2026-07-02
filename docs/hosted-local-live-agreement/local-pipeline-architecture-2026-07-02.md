# Local Pipeline Architecture

Date: 2026-07-02.
Status: active design note.

This note describes the local pipeline first, then derives the local databases
from that pipeline. Local and cloud should share nouns such as trigger, source
bundle, run, execution, and delivery. They should not share tables that local
does not need.

## The Short Version

Local has four different things:

```text
repo wiki files
  canonical pages, topics, manual

query DB
  rebuildable read/search index for the current wiki files

control DB
  durable local product state: repos, branches, sessions, turns, runs,
  run events, trigger events, deliveries

worker workspace
  temporary checkout/worktree where the model runs
```

The query DB answers: "what does the wiki say?"

The control DB answers: "what happened, what should run, what ran, and what was
delivered?"

## Current Tables

Current local CodeAlmanac query DB tables are:

```text
pages
topics
page_topics
topic_parents
file_refs
page_sources
wikilinks
cross_wiki_links
fts_pages
index_metadata
```

These are query/index tables only. They should not get source capture, runs,
trigger policy, delivery records, or agent logs.

Current local run state is not in SQLite. It is a JSON/log ledger under the
repo's Almanac runtime area. The JSON record stores run metadata such as
operation, status, summary, error, timestamps, page changes, and harness
transcript reference. The JSONL log stores normalized run events. Future local
runs and run events should move to the control DB, not into the query DB.

Current cloud `usealmanac` control tables include:

```text
users
accounts
installations
repositories
repository_settings
runs
webhook_deliveries
```

`usealmanac` is reference material, not the target architecture. Both
`usealmanac` and `codealmanac` are expected to change substantially. Do not
copy its current worker/storage shape as the source of truth.

Current cloud hosted-reader tables include:

```text
wiki_indexes
wiki_pages
wiki_topics
wiki_page_topics
wiki_topic_parents
wiki_file_refs
wiki_page_sources
wiki_wikilinks
wiki_cross_wiki_links
```

Cloud stores run rows today. It does not store a full model transcript or full
event log in the `runs` row. The row stores source JSON, delivery JSON, status,
worker call id, files changed, commit SHA, summary, error, and timestamps.

Future cloud should add the same event-log concept that local already has:

```text
run_events
  run_id
  sequence
  timestamp
  kind
  message
  actor
  normalized_event_json
  raw_event_ref
```

`raw_event_ref` can point to Supabase storage, object storage, or another
artifact store when the raw provider event is too large or provider-specific.
The SQL row should store the normalized event used by product UI, logs, and
debugging.

Cross-wiki links are a sunset feature. Future local and cloud query DB schemas
should not add new cross-wiki-link behavior. Existing tables can remain only as
compatibility/read-migration baggage until a schema cleanup removes them.

## Git Hooks

Git has local hooks we can use as trigger adapters:

```text
post-commit
  fires after a successful local commit
  takes no parameters
  cannot affect the commit outcome

post-merge
  fires after a successful merge or pull merge
  gets one parameter saying whether it was a squash merge
  does not run after a conflicted failed merge

post-rewrite
  fires after commit --amend and rebase
  receives old->new rewritten commit pairs on stdin

post-checkout
  fires after checkout/switch/clone/worktree add
  useful for branch metadata refresh, not a finalization trigger
```

Git does not have a built-in "post-commit only on dev/main" hook. Hooks are
repo-level. CodeAlmanac must check the current branch inside the hook and only
continue if the branch is configured as maintained.

A concrete `post-commit` dispatcher looks like:

```bash
repo="$(git rev-parse --show-toplevel)"
branch="$(git symbolic-ref --quiet --short HEAD || true)"
head="$(git rev-parse HEAD)"
codealmanac hook trigger post-commit --repo "$repo" --branch "$branch" --head "$head"
```

`codealmanac hook trigger` is the fast edge. It checks branch configuration and
writes a trigger row. It does not run the model inline.

Hook payload reality:

```text
post-commit
  Git provides no arguments.
  CodeAlmanac computes repo, branch, HEAD, and previous HEAD if needed.

post-merge
  Git provides one argument: squash flag.
  CodeAlmanac still computes repo, branch, HEAD, and previous HEAD.

post-rewrite
  Git provides first argument: amend or rebase.
  stdin contains old_sha new_sha rows.
  CodeAlmanac can use stdin to record rewritten commits, but still computes
  the current branch and HEAD.

post-checkout
  Git provides previous HEAD, new HEAD, and branch-checkout flag.
  Use this for metadata refresh, not as a wiki-update finalization trigger.
```

The branch is not a direct argument for the hooks we expect to use for local
finalization. The dispatcher should read it with Git.

## Local Trigger Model

Local should not be time-scheduled in this model.

The local parallel to cloud branch triggers is:

```text
maintained branch changes locally
  -> hook records trigger event
  -> worker starts a run for that branch
```

Maintained branches are configured per repo:

```text
main
dev
release/*
```

The hook should be fast. It should not run the model inline. It should:

1. detect repo and branch
2. check whether branch is maintained
3. read current HEAD SHA
4. insert or dedupe a trigger event in the control DB
5. spawn or notify a local worker
6. return

Use `post-commit` for normal commits. Use `post-merge` for local merges and
pulls. Use `post-rewrite` for amend/rebase. Deduplicate by repo, branch, and
head SHA so a merge commit cannot start two runs.

Branch selectivity is a database/config check, not a Git feature:

```text
hook event branch = dev
  -> lookup branches(repo_id, name="dev")
  -> if maintained=false: exit
  -> if maintained=true: insert trigger_events row
```

## Local Data Flow

### 1. Setup

```bash
codealmanac local setup
```

Setup writes the control DB:

```text
repositories
branches
```

It also installs Git hook dispatchers for the repo. The hook dispatcher must
coexist with user hooks. It should be managed and idempotent.

### 2. Conversation Capture

Agent capture or transcript scanning writes:

```text
sessions
turns
turn_branches
```

The full session remains a file reference or copied source object. The DB stores
metadata and branch attribution. It does not store only the relevant turns as
the source of truth.

Local source objects should move out of repo runtime state over time:

```text
~/.codealmanac/sources/
  sessions/
  raw-events/
  manifests/
```

This mirrors cloud storage: SQL stores queryable metadata and object storage
stores bulky raw material.

### 3. Trigger Event

A Git hook fires after a maintained branch changes.

The hook writes:

```text
trigger_events
```

The event contains:

```text
repo_id
branch_id
event_kind          # post_commit, post_merge, post_rewrite
head_sha
previous_head_sha   # when available
created_at
status              # pending, claimed, ignored, superseded
```

### 4. Source Selection

The worker claims a pending trigger event.

It queries:

```text
branch_id
  -> turn_branches
  -> turns
  -> sessions
  -> full session files
```

It builds a source bundle for this run. The bundle can be a manifest plus file
references. It does not need to be a permanent table unless we need replay or UI
inspection. The run can store the selected source IDs.

Product invariant: the trigger resolves to source material for the run. More
precisely, the trigger gives repo/branch/head context, then source selection
uses that context to find the relevant conversations and materialize a
`sources/` folder for the worker.

The source bundle should be materialized as files for the worker:

```text
sources/
  manifest.json
  conversations/
  git/
    trigger.json
    commits.json
```

`sources/git/trigger.json` is not a Git internals folder. It is the normalized
record of why this run exists:

```json
{
  "trigger_event_id": "trg_...",
  "event_kind": "post_commit",
  "repo_id": "repo_...",
  "repo_root": "/path/to/repo",
  "branch": "dev",
  "head_sha": "abc123",
  "previous_head_sha": "old789"
}
```

`sources/git/commits.json` is the selected commit context for the run. It can
contain the commit range, messages, changed files, and PR/merge metadata when
available. It exists so the worker has a file-based source bundle, not because
Git hooks provide all of this directly.

The engine receives the full selected sessions through this folder. Branch
attribution selects sessions; it does not slice the session into only matching
turns.

### 5. Run Record

Before model execution starts, the worker writes:

```text
runs
```

The run contains:

```text
id
repo_id
branch_id
trigger_event_id
operation              # ingest/garden/build if needed
source_json            # selected sessions / commit range / manifest ref
delivery_json          # commit_to_branch with expected_head_sha
status                 # queued/running/succeeded/failed/stale/cancelled
worker_workspace       # temp worktree path or id
summary
error
files_changed
commit_sha
created_at
finished_at
```

This belongs in the control DB. It does not belong in the query DB.

The worker also writes normalized events:

```text
run_events
```

These are the local successor to `.almanac/jobs/<run-id>.jsonl`. Cloud should
use the same table name and normalized shape for hosted Codex/Claude worker
events.

Raw run artifacts should be file/object-store backed in both postures:

```text
local:
  ~/.codealmanac/runs/<run-id>/
    run.json
    events.jsonl
    request.json
    result.json
    sources/

cloud:
  supabase storage bucket: run-artifacts/<run-id>/
    run.json
    events.jsonl
    request.json
    result.json
    sources/
    raw-events/
```

The SQL `runs` and `run_events` tables remain the queryable control-plane
record. The bucket/folder is the durable raw artifact store.

### 6. Execution

The local worker should run like the cloud worker conceptually:

```text
materialize workspace
  -> build EngineRunRequest
  -> run model/engine
  -> produce WikiChangeBundle
```

For local, the workspace should usually be a temporary worktree or detached
checkout at the triggering SHA. That is the local equivalent of a cloud worker
container checkout.

Concrete local worker workspace:

```text
~/.codealmanac/workspaces/<run-id>/
  repo/        # temp worktree or detached checkout at expected_head_sha
  sources/    # selected source bundle, read-only to the engine
  run/
    request.json
    result.json
```

This should parallel the cloud worker container:

```text
/work/<run-id>/
  repo/
  sources/
  run/request.json
  run/result.json
```

The source folder should not live inside `repo/`, because it is evidence for
the worker and must not accidentally become a committed wiki artifact.

`run/request.json` is the resolved machine request to the engine. It tells the
engine which repo checkout to read, where the `sources/` folder is, which
operation to run, and what delivery-neutral output path to write.

`run/result.json` is the engine output. It should describe the wiki files
changed, summary, execution status, commit-message description, and any
structured failure. Delivery reads `result.json`; the engine does not commit or
open PRs itself.

Do not use `changed` as a run status. It is a result fact, not a lifecycle
state. A successful engine run can produce wiki changes or no wiki changes:

```json
{
  "status": "succeeded",
  "summary": "Updated auth flow page.",
  "commit_subject": "update auth flow documentation",
  "commit_body": "Updated the auth flow page with the current login and capture setup.",
  "files_changed": ["docs/almanac/pages/auth.md"]
}
```

```json
{
  "status": "succeeded",
  "summary": "No durable wiki update was needed.",
  "commit_subject": null,
  "commit_body": null,
  "files_changed": []
}
```

The engine prompt should instruct the agent to produce a concise
`commit_subject` and optional `commit_body` whenever it changes wiki files. The
publisher owns the final prefix:

```text
almanac: <commit_subject>

<commit_body, if present>
```

The subject after `almanac:` should be the specific description of what
changed. The run summary can be used to derive it, but the publisher should
normalize it into this commit-message contract before committing.

## Collecting Wiki Changes

The target local design should use Git-native workspaces and Git-native diff
collection. Do not recursively copy the repo as the normal execution model.

Workspace creation:

```text
git worktree add --detach <workspace>/repo <expected_head_sha>
```

Fallback only if worktrees are impossible:

```text
git clone --no-checkout <repo> <workspace>/repo
git -C <workspace>/repo checkout <expected_head_sha>
```

After the engine runs, collect only wiki-root changes from the worker repo:

```text
git -C <workspace>/repo add -A -- <almanac_root>
git -C <workspace>/repo diff --cached --name-only -z <expected_head_sha> -- <almanac_root>
git -C <workspace>/repo diff --cached --binary <expected_head_sha> -- <almanac_root> > run/wiki.patch
```

For each changed path:

```text
1. normalize path
2. reject absolute paths
3. reject any path containing ..
4. require path starts with <almanac_root>/
5. record path in result.json
```

`result.json` can store the file list and summary. The durable raw artifact can
store `run/wiki.patch` or per-file content. The important rule is that Git
computes the diff from the expected snapshot to the worker output.

The current `usealmanac` reference code does a simpler version of this: it
stages the Almanac root in the worker checkout, runs
`git diff --cached --name-only` against the base SHA, then reads changed file
contents into the worker bundle. That is reference material, not a final
constraint.

## Worktree Versus Merge

There are two plausible local delivery designs.

Option A is a detached worktree plus deterministic patch/file delivery:

```text
git worktree add --detach <workspace>/repo <expected_head_sha>
agent edits wiki in <workspace>/repo
publisher extracts wiki diff
publisher applies exact diff to maintained branch if HEAD still matches
```

Option B is a temporary branch in a worktree plus Git merge/cherry-pick:

```text
git worktree add -b almanac/run-<run-id> <workspace>/repo <expected_head_sha>
agent edits wiki in <workspace>/repo
publisher commits "almanac: <commit_subject>" on almanac/run-<run-id>
publisher merges or cherry-picks that commit into the maintained branch
```

Option B is attractive because Git already knows how to move commits between
branches. It also makes the worker output a real commit before delivery.

Option A should be the default for v1 because it keeps delivery policy simple:

```text
if branch HEAD == expected_head_sha:
  apply exact wiki diff and commit
else:
  mark stale and rerun
```

Option B becomes risky if it is allowed to merge after the maintained branch has
moved, because Git may automatically combine a stale wiki update with newer repo
state. That breaks the invariant that source bundle, repo snapshot, and delivery
target all refer to the same head SHA. Option B is acceptable only if the
publisher still enforces `HEAD == expected_head_sha`; in that case it is mostly
an implementation detail for creating the same Almanac commit.

Do not put `sources/` inside the repo worktree. The source bundle is evidence
for the worker, not repo content. Keeping it as a sibling avoids accidental
commits, accidental wiki links to local artifact paths, and `.gitignore`
dependence.

Default recommendation:

```text
repo/     # Git-native worktree at expected_head_sha
sources/  # sibling evidence folder, outside repo/
run/      # request/result/patch artifacts
```

Use a temporary branch later only if patch application proves awkward or if we
want the worker output to be inspectable as a Git commit before publication.

## Concrete Local Trigger Algorithm

Git hooks are only notification edges. They do not provide all product facts.
The dispatcher fills in the missing facts by calling Git and reading the control
DB.

```text
post-commit/post-merge/post-rewrite fires
  -> dispatcher cwd is repo root
  -> repo_root = git rev-parse --show-toplevel
  -> branch = git symbolic-ref --quiet --short HEAD
  -> head_sha = git rev-parse HEAD
  -> repository = control DB lookup by repo_root / remote
  -> branch row = control DB lookup by repo_id + branch
  -> if branch.trigger_enabled is false: exit
  -> previous_head_sha = branch.last_seen_head_sha
  -> update branch.last_seen_head_sha = head_sha
  -> insert or dedupe trigger_events(repo_id, branch_id, head_sha)
  -> notify worker drainer
```

`previous_head_sha` should primarily come from CodeAlmanac's control DB
`branches.last_seen_head_sha`, not from hook arguments. Some hooks provide useful
extra data, but the DB gives one consistent rule across commit, merge, and
rewrite events.

Hook-specific extras:

```text
post-commit
  no args; compute branch/head from Git

post-merge
  one squash flag arg; compute branch/head from Git

post-rewrite
  first arg is amend/rebase; stdin has old_sha new_sha rows
```

## Local Locking And Coalescing

There are two locks:

```text
drainer lock
  one local worker-drainer process per machine

branch execution lease
  at most one running run per repo_id + branch_id
```

The drainer lock prevents two background processes from claiming the same queue
at the same time. The branch lease prevents two model jobs from running for the
same branch concurrently.

Claiming policy:

```text
1. start transaction
2. find newest pending trigger per repo_id + branch_id
3. mark older pending triggers for that branch superseded
4. if a run is already running for that branch, leave newest trigger pending
5. otherwise mark newest trigger claimed and create runs row
6. commit
7. start worker for that run
```

This means multiple repos and branches can run concurrently, but one branch is
serialized and coalesced to the newest head.

The active user working tree should not be the model's main execution surface
once automatic post-commit triggers exist, because the user may keep editing
while the worker runs.

### 7. Delivery

Local delivery should parallel cloud direct commit:

```text
delivery target:
  commit_to_branch(branch, expected_head_sha)
```

Delivery is deterministic publisher logic. The agent/engine does not decide how
to merge stale output, does not push, and does not commit to the maintained
branch.

Delivery steps:

```text
1. read result.json
2. validate every changed file is inside the configured Almanac root
3. compute the wiki diff from worker repo/
4. check current branch HEAD == expected_head_sha
5. if equal, apply exactly that wiki diff and create the Almanac commit
6. if not equal, mark run stale and enqueue a newer trigger
```

Concrete local apply algorithm:

```text
1. acquire branch delivery lease for repo_id + branch_id
2. current_head = git -C <real_repo> rev-parse <branch>
3. if current_head != expected_head_sha:
     mark run stale
     enqueue trigger for current_head
     stop
4. apply the patch/file bundle to the real repo
5. git -C <real_repo> add -A -- <almanac_root>
6. verify staged diff touches only <almanac_root>
7. if staged diff is empty:
     mark run succeeded with no delivery commit
     stop
8. git -C <real_repo> commit with subject "almanac: <commit_subject>"
9. record delivered_commit_sha
```

For cloud direct-commit delivery, the equivalent is GitHub-native:

```text
1. read current branch ref through GitHub
2. require current head == expected_head_sha
3. create blobs/tree/commit for the changed wiki files
4. fast-forward the branch ref with force=false
```

Cloud PR delivery is similar, except it creates a new update branch at the
expected SHA and opens a PR.

The publisher checks that the branch is still at `expected_head_sha`. If it is
not, the run is stale. That means the user or another process changed the branch
while the worker was running.

Stale-head behavior:

1. mark the current run `stale` or `cancelled_stale`
2. do not apply the worker's wiki changes
3. insert a new trigger event for the newer branch head
4. start a new run from the newer head

This is better than trying to merge the stale worker output, because the source
selection and repo snapshot may both be outdated.

The stale case should not invoke the agent to "merge" the old wiki diff into the
new branch. Starting a new run is simpler and preserves the invariant that each
source bundle, repo snapshot, and delivery target refer to the same head SHA.

Local delivery therefore records:

```text
deliveries
```

or stores equivalent fields on `runs` at first:

```text
run_id
target_kind = commit_to_branch
branch_id
expected_head_sha
delivered_commit_sha
status
```

Delivery writes Git. Query DB refresh happens after delivery.

## Minimal Control DB

The smallest local control DB that supports this pipeline is:

```text
repositories
branches
sessions
turns
turn_branches
trigger_events
runs
run_events
```

`deliveries` can be a separate table or fields on `runs`.

No local `accounts` table is needed for this pipeline. Store `owner_login`,
`owner_type`, `full_name`, and provider IDs on `repositories`.

## Queue And Concurrency

Across different repos or branches, runs can proceed concurrently up to the
local/cloud worker limit.

For the same repo and branch, there should be at most one active execution.
Newer trigger events should coalesce to the newest head:

```text
dev at A triggers run A
dev moves to B while run A is running
  -> insert trigger B
  -> keep B pending
  -> optionally mark run A cancel_requested
dev moves to C before B runs
  -> mark trigger B superseded
  -> keep only trigger C pending
run A finishes
  -> delivery sees expected_head_sha A != current C
  -> mark run A stale/cancelled_stale
  -> start run C
```

This avoids running multiple expensive model jobs for the same branch while
still keeping the newest branch head covered.

Local can enforce this with the control DB plus a worker lease:

```text
worker_leases or worker.lock
  one drainer process per user machine

trigger_events
  status: pending, claimed, superseded, ignored
  unique-ish identity: repo_id, branch_id, head_sha

runs
  status: queued, running, delivered, failed, stale, cancelled
```

Cloud should use the same policy with Postgres row locks or an equivalent
claiming mechanism. The target cloud design should be reasoned from this model,
not from the current `usealmanac` implementation.

## End-To-End Flow

```text
developer commits to dev
  -> post-commit hook fires
  -> hook sees dev is maintained
  -> hook inserts trigger_events row for repo/dev/head_sha
  -> worker claims event
  -> worker selects sessions through turn_branches
  -> worker creates runs row
  -> worker writes run_events during execution
  -> worker creates temp worktree at head_sha
  -> engine updates wiki in temp worktree
  -> publisher applies wiki changes to dev if expected head still matches
  -> if expected head changed, run is stale and a new trigger is inserted
  -> publisher creates Almanac commit
  -> run is marked delivered
  -> query DB refreshes from repo wiki files
```

The parallel cloud flow is:

```text
GitHub branch/PR event
  -> cloud trigger event
  -> source selection from cloud source library
  -> cloud runs row
  -> worker container checkout
  -> engine updates wiki
  -> GitHub publisher commits or opens PR
  -> hosted reader index refreshes
```

The names are parallel. The DBs are not copied blindly.
