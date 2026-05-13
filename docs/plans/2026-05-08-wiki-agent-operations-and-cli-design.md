# Wiki Agent Operations And CLI Design

## Purpose

This document defines the product and architecture shape for the next
`codealmanac` generation. It is not an implementation plan. It is the design
brief that should drive the implementation plan.

**This is a design document, not a patch plan. The implementation that follows
from it should optimize for a clean, extensible codebase, even if that requires
substantial refactoring. Do not preserve a smelly architecture merely to land the
feature faster. The final code should be simple, well-factored, provider-aware,
and pleasant to extend.**

**During implementation, maintain an implementation log and a decision log.**
The implementation log should record what was built, what changed, what tests
were run, and what remains. The decision log should record design choices,
tradeoffs, rejected alternatives, and places where the plan changed after
touching the real code. Commit frequently at coherent checkpoints so the work is
auditable and resumable.

The core shift is:

```text
The wiki is the product.
Sources are evidence.
Prompts define the algorithm.
The provider CLI/SDK is the harness.
```

`codealmanac` should use Claude, Codex, Cursor, and future agent providers as
capable file-editing/code-understanding harnesses. We should not build our own
full agent runtime yet. Our code should provide selection, context, prompts,
logs, safety boundaries, outcome summaries, indexing, and provider/model
configuration. The agent harness provides reading, searching, editing, shell
tooling, and subagents when available.

## Operating Vocabulary

Use three operation names:

```text
Build
Absorb
Garden
```

These are internal product concepts, not necessarily exact CLI commands.

### Build

Construct the first high-quality wiki for a repo.

```text
Input:
  repo, optional historical conversations/sessions/docs

Output:
  initial .almanac wiki
```

This replaces the current "quick stub scaffold" bootstrap philosophy. A good
build should create a useful map of the codebase, not just placeholder anchors.

### Absorb

Improve the existing wiki using a source as starting evidence.

```text
Input:
  existing wiki, repo, source

Output:
  improved wiki or no-op
```

The source can be a coding session, file, folder, git diff, PR, issue, design
doc, or conversation export. The operation is the same: the agent starts from
the source, looks outward into the wiki/repo/history as needed, and improves the
wiki.

Absorb is not summarization. It is not required to put every source detail into
the wiki. It may use all, some, or none of the source. The success criterion is
wiki improvement.

### Garden

Improve the existing wiki by inspecting it as a whole graph.

```text
Input:
  existing wiki, repo, optionally recent history

Output:
  more coherent wiki
```

Garden is global maintenance. It can merge, split, archive, relink, retopic,
rewrite, or create missing anchors/hubs. It is not merely a review of a local
change. It owns long-term graph health.

## The Governing Objective

Every write-capable operation should share this doctrine:

```text
Improve the wiki.
```

For source-driven operations:

```text
Improve the whole wiki using this source as starting evidence.
```

Important consequences:

- The source is not the output.
- Coverage of a source is subordinate to the quality of the final wiki.
- No-op is valid when the source does not improve the wiki.
- Broad restructuring is valid when evidence shows the existing organization is
  wrong or misleading.
- The agent should consider the whole wiki, but should not perform unrelated
  churn.

Better phrasing than "local improvement first":

```text
The wiki's long-term coherence outranks local source coverage.
Keep the scope proportional to the evidence and the size of the revealed problem.
```

This gives the model permission to think globally without making every Absorb
run a license to reorganize everything.

## Prompt-Based Algorithm Design

The algorithm should mostly live in prompts, not TypeScript.

Avoid making code enforce a rigid sequence like:

```text
always census -> always scout -> always write -> always review
```

The better model is:

```text
The prompt describes the objective, quality bar, allowed moves, recommended
strategies, source-specific guidance, and success criteria.

The agent decides whether to survey, search, read, spawn subagents, inspect git,
rewrite one page, or restructure several pages.
```

This matches the project philosophy: intelligence in prompts, not pipelines.

The code can still do deterministic setup when it saves tokens or prevents
mistakes:

- resolve repo root and `.almanac/`
- resolve source paths or session transcripts
- build file/folder inventories
- collect cheap git evidence, when requested or safe
- choose prompt modules
- configure provider/model
- open logs/state records
- snapshot pages before/after
- reindex after writes
- format outcome summaries

These are harness responsibilities, not wiki judgment.

## Prompt Modules

The prompt system should be composable.

Potential prompt files:

```text
prompts/base/wiki-doctrine.md
prompts/operations/build.md
prompts/operations/absorb.md
prompts/operations/garden.md
prompts/sources/session.md
prompts/sources/session-codex.md
prompts/sources/session-claude.md
prompts/sources/session-cursor.md
prompts/sources/session-windsurf.md
prompts/sources/file-folder.md
prompts/sources/git-diff.md
prompts/sources/pr-issue.md
prompts/reviewer.md
```

The assembled prompt for `almanac capture` might be:

```text
wiki doctrine
+ absorb operation
+ session source guidance
+ repo-specific .almanac/README.md is available to read
+ concrete transcript/session path
```

The assembled prompt for `almanac ingest docs/foo.md` might be:

```text
wiki doctrine
+ absorb operation
+ file/folder source guidance
+ concrete target inventory
```

The source guidance acts like a skill. It tells the agent how to treat that
source type, but it does not limit the agent to that source.

Source guidance can be layered. For example, a coding session may include the
generic `session.md` guidance plus app-specific notes such as
`session-codex.md` or `session-windsurf.md`. These are prompt skills, not
separate backend pipelines. The agent should use them as operating knowledge and
still make judgment calls based on the actual source, wiki, repo, and history.

## Source Guidance

### Session Source

A coding session is an event in the codebase, not just a transcript.

Guidance:

```text
Start from the session transcript.
Use it to understand what the user asked, what the agent learned, what failed,
what was fixed, and what conclusions were reached.
Inspect changed files, git diff, tests, commit messages, or related code when
useful.
Separate durable codebase knowledge from task chatter.
Look for adjacent wiki pages made stale by the change.
Improve the wiki only where the session changes durable understanding.
```

The transcript is a starting lens. The agent may inspect the repo, wiki, and git
history as needed.

Session sources may come from different coding apps: Claude Code, Codex, Cursor,
Windsurf, and future tools. The app determines how to find and understand the
session evidence. It does not determine which provider/model writes the wiki.

### File Or Folder Source

Guidance:

```text
Start from the target path or inventory.
Do not summarize the file/folder.
Read selectively.
Infer what repo concepts the target concerns.
Search the existing wiki for canonical homes.
Inspect related source files or git history when useful.
Improve the wiki where this context changes durable understanding.
```

The target gives direction. It is not a boundary.

### Git Diff Source

Guidance:

```text
Start from changed files and diff.
Use git read-only commands to understand context.
Identify newly introduced or removed flows, decisions, invariants, or gotchas.
Look for pages whose file refs, topics, or prose are now stale.
Improve the wiki where the code change changes durable understanding.
```

### PR / Issue Source

Guidance:

```text
Start from the PR/issue conversation.
Extract durable decisions, rejected alternatives, incidents, constraints, and
future follow-ups.
Verify against code when claims concern current behavior.
Prefer updating existing anchors/flows over creating standalone discussion pages.
```

## Allowed Wiki Moves

Every write-capable prompt should explicitly name allowed outcomes:

- no-op
- create
- update
- rewrite
- merge
- split
- archive
- supersede
- retopic
- relink
- create hub/index page
- create stub

The model should know that no-op, merge, archive, and split are first-class
successes. Otherwise agents bias toward create/update only.

## Page And Topic Guidelines

The product needs shared guidelines, separate from operation prompts.

These guidelines may start as bundled prompt files and become self-updatable
wiki conventions later.

They should define:

### What Deserves A Page

A page should usually capture knowledge that helps future coding agents avoid
rediscovery:

- non-obvious system behavior
- cross-file flows
- architecture boundaries
- decisions and rejected alternatives
- constraints and invariants
- incidents and gotchas
- active migrations
- repo-specific practices
- external services as used in this repo
- important domain concepts

A page should usually not exist for:

- generic library documentation
- trivial utilities
- one-off implementation details
- a source file summary
- a session summary
- facts obvious from reading one nearby file

### What Deserves A Topic

A topic should group pages the agent may want to browse or query together.

Good topics:

- stable domains: `auth`, `billing`, `indexing`
- structural classes: `flows`, `decisions`, `incidents`, `systems`
- work areas: `cli`, `agents`, `registry`, `topics`

Bad topics:

- one page only unless clearly expected to grow
- generic tags like `misc`
- implementation detail tags that duplicate file paths
- temporary task labels

### What Deserves A Hub

A hub/index page is useful when a topic is dense enough that ordering and
annotation matter.

Signals:

- many pages under one topic
- multiple current/archived approaches
- several flows that new agents confuse
- a central area with scattered incidents/decisions

Topics are indexes. Hubs are maps.

## Read-Only Git Policy

Agents may use git as evidence.

Allowed git patterns:

```text
git status
git diff
git diff --stat
git log
git show
git blame
git grep
git ls-files
```

Disallowed git patterns:

```text
git commit
git push
git reset
git checkout
git clean
git rm
git rebase
git merge
```

The exact enforcement may depend on provider harness support. At minimum, this
must be explicit in prompts. If future provider adapters support command
allowlists, enforce read-only git there too.

## Reviewer Versus Garden

Reviewer and Garden are different.

Reviewer:

```text
Checks a proposed local change.
Returns critique.
Does not write files.
```

Garden:

```text
Inspects the wiki as a whole.
Can perform major wiki edits.
Owns long-term organization.
```

Use reviewer after substantive writes. Use garden when graph health itself is
the task or when a large source/change exposes broader organizational problems.

## Triggers

### Build

User-triggered:

```text
almanac init
```

Runs when a repo has no meaningful `.almanac/` yet.

### Absorb

User-triggered:

```text
almanac ingest <path>
almanac ingest --session <id>
almanac ingest --diff <rev>
```

Automatic:

```text
scheduled capture sweep
post-commit hook, maybe later
PR/issue connector, maybe later
```

### Garden

User-triggered:

```text
almanac garden
```

Suggested or automatic triggers:

- many pages changed in one Absorb run
- many new pages created
- referenced files deleted or renamed
- health finds broken links, stale file refs, empty topics, or many orphans
- no garden pass after significant activity
- user explicitly asks to reorganize or clean up

Garden should not run after every small Absorb by default. It is more expensive
and more likely to create broad diffs.

## Cost Observability

Do not introduce rigid code phases just to measure cost.

Prompt-based operations may contain conceptual phases, but the provider harness
sees one agent run plus any subagents/tool calls the provider exposes.

Track what is actually observable:

- provider
- model
- total cost when provider reports it
- token usage when provider reports it
- duration
- turn count
- session id / run id
- source type
- source size or inventory summary
- pages created/updated/archived
- raw log path
- subagent count if visible
- per-agent or per-message cost only if provider exposes it

Do not create orchestration stages just for accounting.

For large or batch operations, prefer an estimate before starting when the CLI
can cheaply compute one:

- number of source files or sessions
- total bytes
- rough token range, if a token estimator is available
- likely provider/model price range, if the provider registry has pricing data
- clear warning when exact cost is unknown

If exact estimates are not available, print a size-based warning and record the
actual cost after the run. Expensive batch runs should require confirmation in a
TTY and `--yes` in non-interactive contexts.

The goal is to compare quality against cost over time:

```text
Did using subagents improve Build enough to justify the extra cost?
Did Garden runs produce meaningful graph improvements?
Do large folder Absorb runs mostly no-op?
Which provider/model produces the best wiki delta per dollar?
```

## Provider Harness Mapping

All operations should run through the existing provider abstraction:

```text
provider selection -> prompt assembly -> runAgent -> logs -> page delta -> reindex
```

The provider harness supplies:

- file reading
- searching
- shell commands
- file edits
- subagents when supported
- model-specific reasoning ability

`codealmanac` supplies:

- prompt doctrine
- source target details
- config/provider selection
- auth readiness checks
- logs/state
- wiki page snapshots
- index rebuild
- outcome summary

Provider capabilities differ. The operation prompt should say "use subagents if
available and useful," not depend on subagents being present.

If a provider lacks programmatic subagents, the single agent can still perform
the operation. The prompt should be written so the algorithm degrades gracefully.

## Session App Versus Writer Provider

For coding-session capture, distinguish two independent choices:

```text
app/source = where the session evidence comes from
using      = which provider/model writes the wiki
```

Examples:

```text
--app codex
  Read Codex session history.

--using claude/sonnet
  Use Claude Sonnet as the wiki-writing harness/model.
```

These must remain separate. A user may want to capture a Codex session using
Claude, or a Windsurf session using Codex. The app is evidence selection. The
writer provider/model is execution selection.

Prefer `--using <provider[/model]>` for per-command writer overrides. It reads
better than `--agent`/`--model` in mixed-source commands:

```bash
almanac capture --app codex --using claude/sonnet
```

Meaning:

```text
Capture the latest Codex session for this repo, using Claude Sonnet to update
the wiki.
```

`--agent` and `--model` may remain as compatibility or low-level flags, but the
primary UX should move toward `--using`.

This requires a centralized provider/model resolver:

```text
claude/sonnet -> provider: claude, model: provider alias "sonnet"
claude/opus   -> provider: claude, model: provider alias "opus"
codex/gpt-5   -> provider: codex, model: provider alias or literal
claude        -> provider: claude, model: configured/default
```

The registry does not need to know every model on day one. It should support:

- provider ids
- provider defaults
- common aliases
- literal model passthrough
- config/env/flag precedence

The same `--using` flag should apply consistently:

```bash
almanac init --using claude/sonnet
almanac capture --app codex --using claude/sonnet
almanac ingest docs/foo.md --using codex/gpt-5
almanac garden --using claude/opus
```

## CLI Frontend

The CLI is the frontend. It should express user intent cleanly while mapping to
the internal operations.

CLI design principles from `docs/research/2026-05-07-cli-surface-design.md` and
`docs/research/2026-05-07-cli-config-best-practices.md`:

- commands are user intents
- required direct objects can be positional when there is only one obvious
  operand
- flags describe how the operation runs
- use config/env/flags precedence: flag > `ALMANAC_*` env > project config >
  user config > defaults
- non-interactive commands must not prompt unless explicitly safe
- destructive or expensive operations need confirmation or `--yes`
- diagnostics should explain origin and readiness

### Recommended Public Surface

Near-term:

```bash
almanac init
almanac capture
almanac capture --session <id>
almanac capture <transcript-path>
almanac capture <session-file...>
almanac capture --app <app>
almanac ingest <file-or-folder>
almanac garden
```

Internal mapping:

```text
init      -> Build
capture   -> Absorb + session source guidance
ingest    -> Absorb + file/folder source guidance
garden    -> Garden
```

Why keep `capture` near-term:

- capture is a first-class user intent and existing mental model
- it is already hook-backed
- no-arg `capture` means "latest session," which is convenient
- `ingest --session` is less obvious for automatic background behavior

Future optional unification:

```bash
almanac ingest --session <id>
almanac ingest --latest-session
almanac ingest --diff <rev>
```

Do not rush this. The command surface should be optimized for user intent, not
internal elegance.

### Capture Syntax

`capture` is for coding-session history. `ingest` is for user-provided
context/docs/files. A session file is technically a file, but semantically it is
a coding session, so the primary command should be `capture`.

Recommended examples:

```bash
# Capture the latest detectable coding session for this repo.
almanac capture

# Capture the latest Codex session for this repo.
almanac capture --app codex

# Capture the latest Claude Code session for this repo.
almanac capture --app claude

# Capture a specific session by id.
almanac capture --app codex --session abc123

# Capture one explicit session file.
almanac capture ~/.codex/sessions/2026/05/08/rollout-abc123.jsonl

# Capture multiple explicit session files.
almanac capture session-a.jsonl session-b.jsonl session-c.jsonl

# Capture recent sessions from one app.
almanac capture --app codex --since 7d

# Capture recent sessions from all supported apps.
almanac capture --all-apps --since 7d

# Capture at most 5 recent Codex sessions.
almanac capture --app codex --limit 5

# Capture Codex sessions since an exact date.
almanac capture --app codex --since 2026-05-01

# Capture everything from Codex, explicitly confirmed.
almanac capture --app codex --all --yes

# Capture recent sessions, using Claude Sonnet as the wiki-writing model.
almanac capture --app codex --since 7d --using claude/sonnet
```

Rules:

```text
almanac capture
  latest session for this repo, any supported app

almanac capture --app codex
  latest Codex session for this repo

<session-file...>
  explicit coding-session files

--session <id>
  one specific session id

--since <duration|date>
  bounded batch mode

--limit <n>
  bounded batch mode

--all
  all matching sessions; expensive and should require confirmation when large

--all-apps
  search all supported apps; best with --since or --limit

--using <provider[/model]>
  wiki-writing provider/model override, independent of --app
```

No capture selector should have an ambiguous unbounded default. In particular:

```text
capture
  means latest one

capture --app codex
  means latest one from Codex

capture --since 7d
  is explicit batch mode

capture --all
  is explicit all mode
```

### `init`

```bash
almanac init [--using <provider[/model]>] [--quiet] [--force] [--json]
```

Meaning:

```text
Build the first wiki for this repo.
```

This should eventually replace the current stub-oriented bootstrap prompt.

### `capture`

```bash
almanac capture
almanac capture --app <app>
almanac capture --session <id>
almanac capture <session-file...>
```

Meaning:

```text
Absorb an AI coding session.
```

This command remains the session-capture target used by manual capture and by
scheduled `capture sweep` jobs unless a future CLI redesign proves that
`ingest --session` is clearer.

### `ingest`

```bash
almanac ingest <file-or-folder> [--yes] [--using <provider[/model]>]
```

Meaning:

```text
Absorb user-provided context.
```

The positional target is correct because it is the direct object of the command.

No-arg `ingest` should not mean latest session if `capture` remains. Avoid
ambiguous no-arg behavior.

### `garden`

```bash
almanac garden [--using <provider[/model]>] [--quiet] [--json]
```

Meaning:

```text
Improve the existing wiki as a whole.
```

If the operation may make broad changes, the prompt should be clear and the
summary should report major structural moves.

## Current Recommendation

Use this internal model:

```text
Build
Absorb
Garden
```

Use these public commands for now:

```text
init
capture
ingest
garden
```

Use prompt modules to avoid duplicating algorithms:

```text
capture = Absorb + Session guidance
ingest  = Absorb + File/Folder guidance
```

Do not make the algorithm a rigid TypeScript state machine. Make it a strong
prompt doctrine running inside provider harnesses, with deterministic code only
for context assembly, safety, logs, cost observability, snapshots, indexing, and
outcomes.
