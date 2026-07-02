# Local CLI Future Shape

Date: 2026-07-01.
Status: partially superseded design note.

2026-07-02 update: the local branch-maintenance path is no longer time-based.
Sections below that mention `automation` or `local schedule` describe the older
local-only CLI and should not be treated as the current trigger decision. The
current local trigger model is branch-based Git hooks filtered through the
control DB: `post-commit`, `post-merge`, and `post-rewrite` record trigger
events only for configured maintained branches.

This note records how the current local Python CLI should evolve if CodeAlmanac
ships a cloud-first product while keeping a free local offering.

## Current Local Shape

The current Python CLI is local-only.

Public commands include:

```bash
codealmanac setup
codealmanac init
codealmanac ingest <inputs...>
codealmanac sync
codealmanac garden
codealmanac jobs
codealmanac automation
codealmanac serve
codealmanac search
codealmanac show
```

Current meaning:

| Current command | Product meaning today |
| --- | --- |
| `setup` | Install local agent instructions and optionally local scheduled automation. |
| `init` | Create/register the repo-local wiki root. |
| `ingest <inputs...>` | Ask a local harness to fold explicit source inputs into the wiki. |
| `sync` | Scan quiet local Codex/Claude transcripts and run local ingest for eligible material. |
| `garden` | Ask a local harness to improve existing wiki structure and graph health. |
| `jobs` | Inspect/cancel/attach local background lifecycle runs. |
| `automation` | Install/remove local scheduled `sync` and `garden` jobs. |

The current implementation already has important shared seams:

- `sources` resolves explicit source inputs and discovers local transcripts.
- `runs` owns the execution ledger, event logs, cancellation, and queue state.
- `ingest`, `garden`, and `sync` are workflows over shared services.
- `queue` starts durable background runs and drains them through one worker.

The issue is not missing internals. The issue is deciding which local words are
real product concepts and which words are implementation details.

Current decision: `ingest`, `garden`, and `jobs` are good local words.
`automation` should become `schedule` in user-facing CLI copy, because users are
choosing when local maintenance runs rather than installing an abstract
automation subsystem.

## Future Product Shape

Use one CLI namespace:

```bash
codealmanac setup        # cloud/team setup
codealmanac local setup  # local-only setup
```

Cloud top-level setup is for the paid team/repo automation product.
Local setup is for GitHub tinkerers and OSS users who want to run CodeAlmanac
without a cloud account.

Cloud is the polished default surface. Local is the developer/OSS surface. That
means local can expose precise lifecycle controls such as `--using`,
`ingest`, `garden`, `jobs`, and `schedule`; cloud should hide those knobs until
there is a supported cloud product feature for them.

Do not invent cloud commands only for symmetry with local. Ship only the cloud
commands backed by the cloud product today.

## Recommended Local Public Commands

```bash
codealmanac local setup
codealmanac local ingest <inputs...>
codealmanac local sync
codealmanac local garden
codealmanac local status
codealmanac local serve
codealmanac local jobs
codealmanac local jobs show <run-id>
codealmanac local jobs logs <run-id>
codealmanac local jobs attach <run-id>
codealmanac local jobs cancel <run-id>
codealmanac local schedule enable
codealmanac local schedule status
codealmanac local schedule disable
```

Existing local read commands can remain top-level because they read committed
repo files:

```bash
codealmanac search "auth"
codealmanac show auth-flow
codealmanac serve
```

`codealmanac local serve` can be an alias for users who entered through the
local-first README path.

## Local Lifecycle Verbs

Do not collapse local lifecycle work into `local run`.

`run` is too vague for local usage because local users are often deliberately
choosing the kind of maintenance they want:

| Command | Meaning |
| --- | --- |
| `codealmanac local ingest <inputs...>` | Fold selected source material into the wiki. |
| `codealmanac local sync` | Find eligible quiet local agent conversations and ingest them. |
| `codealmanac local garden` | Improve the existing wiki graph, links, topics, stale pages, and weak pages. |
| `codealmanac local jobs` | Inspect local lifecycle executions. |
| `codealmanac local schedule ...` | Configure recurring local sync/garden execution. |

These words are specific enough to teach the product. They also map cleanly to
the current Python workflows.

`--using` belongs on local lifecycle commands. It lets a developer choose the
local harness:

```bash
codealmanac local ingest README.md --using codex
codealmanac local garden --using claude
```

Cloud should not expose `--using` as a normal setup or run option. Cloud owns
worker/model selection as product policy unless a future enterprise/admin
setting makes it explicit.

## Setup Coexistence

The edge case is valid:

```bash
codealmanac setup
codealmanac local setup
```

This should be allowed. The two setup commands configure different scopes:

| Command | Scope | Writes |
| --- | --- | --- |
| `codealmanac setup` | Cloud user/machine setup | Cloud auth state, browser-approved capture config, cloud-aware agent instructions. |
| `codealmanac local setup` | Local repo/user setup | Repo wiki root, local agent instructions, optional local schedule. |

Rules:

- Both commands must be idempotent.
- Neither command should undo the other.
- Shared instruction files must use one managed CodeAlmanac block, not dueling
  cloud/local blocks.
- The managed instruction block should describe both installed capabilities:
  cloud capture if enabled, local wiki commands if local setup has run.
- If cloud capture and local transcript sync both want hooks for the same
  provider, setup should show the resulting mode instead of silently replacing
  it.
- `status` should make coexistence visible.

Example status:

```text
Cloud: signed in as rohan
Capture: Codex enabled for cloud
Local wiki: ./almanac
Local schedule: disabled
```

If a user runs `codealmanac setup` after `codealmanac local setup`, cloud setup
should preserve the local wiki and local schedule. If a user runs
`codealmanac local setup` after `codealmanac setup`, local setup should
preserve cloud auth and cloud capture.

## Local Snapshot And Delivery Model

Local should still mirror the cloud conceptual pipeline:

```text
capture/collect sources
  -> choose a local finalization event
  -> select relevant source material
  -> create a local run snapshot
  -> execute ingest/garden against that snapshot
  -> deliver wiki changes locally
```

The local run snapshot should record:

- repo root
- current branch
- starting commit
- dirty working-tree state summary
- configured Almanac root
- selected source refs
- source runtime snapshots where needed
- harness and model configuration

Open design choice: execution location.

| Option | Behavior | Tradeoff |
| --- | --- | --- |
| Current checkout | Run directly in the user's working tree. | Simple and matches today, but the agent sees a moving target if the user edits during the run. |
| Temporary worktree | Create a Git worktree at the starting commit, run there, then apply the wiki diff back. | Stronger snapshot semantics, safer for long runs, more machinery. |
| Patch-only sandbox | Give the harness source snapshots and apply only the resulting wiki patch. | Cleanest delivery boundary, hardest to implement with current agent workflow. |

Recommendation: use current checkout for now, but name the snapshot seam and
record starting commit/dirty state in the job record. Move to temporary
worktrees when local runs start conflicting with user edits or when cloud/local
worker parity becomes more important.

Local delivery should be explicit:

```text
default: write wiki changes to the working tree
future optional: write to a local branch
future optional: create a local commit
not local: open a GitHub PR
```

Cloud delivery is PR/commit through GitHub. Local delivery is a working-tree
diff unless the user explicitly asks for a stronger delivery mode.

## Mapping From Current Commands

| Current local command | Future public command | Notes |
| --- | --- | --- |
| `codealmanac setup` | `codealmanac local setup` | Current top-level `setup` must become cloud setup in the cloud-first product. |
| `codealmanac init` | `codealmanac local setup` or `codealmanac local init` | Local setup can wrap init plus instruction setup. Keep `init` only if repo scaffold remains a distinct power-user step. |
| `codealmanac ingest <inputs...>` | `codealmanac local ingest <inputs...>` | Keep `ingest` first-class for local lifecycle work. |
| `codealmanac sync` | `codealmanac local sync` | Sync is the local conversation-capture ingestion path. |
| `codealmanac garden` | `codealmanac local garden` | Garden is a good local word for graph/wiki maintenance. |
| `codealmanac jobs` | `codealmanac local jobs ...` | Keep `jobs` for local lifecycle executions. Cloud may use `runs`. |
| `codealmanac automation` | `codealmanac local schedule ...` | Users configure a schedule; they do not install "automation" as a product noun. |

## Architecture Direction

Do not make local exactly mirror cloud infrastructure.

Local should mirror the cloud conceptual pipeline enough that the same engine
contracts can be reused:

```text
select sources -> run engine -> record run -> apply delivery
```

But local should not build a cloud-style source library, team branch mapping, or
delivery control plane unless a real local user need appears.

Local should have source selection, run snapshots, jobs, and delivery, but the
storage can remain repo-local. Local does not need a cloud-style source library
or team branch mapping table unless a concrete local use case appears.

Local delivery is working-tree writes by default. Cloud delivery is GitHub
PR/commit. Local job state is repo-local files. Cloud run state is cloud
DB/dashboard.

## Decision

Do not hide the local lifecycle verbs behind `local run`.

Keep the current services/workflows. Reshape the public local CLI mainly by
putting local lifecycle work under the `local` namespace and renaming
`automation` to `schedule`:

```text
local setup
local ingest
local sync
local garden
local status
local jobs
local schedule
```

The stronger future-facing seam is not a generic `run` command. It is the local
snapshot and delivery model behind each lifecycle command.
