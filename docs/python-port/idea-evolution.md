# Python Port Idea Evolution

Updated: 2026-06-29

Record hypothesis changes here. Do not rewrite history; append a new entry when
evidence changes the shape.

## 2026-06-29 - Fresh Python Codebase, Not a Ported TS Shape

Old hypothesis:
Reuse the existing TypeScript repository shape while translating modules to
Python.

New hypothesis:
Archive the TypeScript implementation under `archive/code/` and rebuild a
Python codebase around service-owned verbs, store-owned persistence,
workflow-owned coordination, and `app.py` as the composition root.

Evidence that forced the change:
The live agreement defines a local-only Python v1 and says the old Node code is
behavior reference, not code to preserve. Cosmic Python's service-layer and
composition-root guidance also pushes entrypoints away from product decisions.

Code or product assumption affected:
CLI commands must dispatch into services/workflows. They must not become the
internal API used by automation or future server wrappers.

Follow-up test:
The first scaffold should include an architecture test that imports the CLI and
application root without importing archived TypeScript paths or constructing
service dependencies in command handlers.

## 2026-06-29 - Viewer Is A Read Service, Not Server-Owned Logic

Old hypothesis:
`serve` could be restored as a server adapter directly over existing read
services, because it is mostly HTTP routing and static assets.

New hypothesis:
`serve` deserves a first-class `viewer` service. The HTTP adapter is only a
primary entrypoint. `ViewerService` owns browser payload assembly over the
existing index service, while markdown truth remains in `wiki` and SQLite
projection truth remains in `index`.

Evidence that forced the change:
The archived `almanac-serve` page shows the viewer has product semantics:
overview, page, topic, search, backlinks, file refs, related pages, and rendered
wikilinks. Cosmic Python chapter 4 says controllers should stay thin once
orchestration starts creeping into the entrypoint.

Code or product assumption affected:
`server/app.py` must not open SQLite, parse pages, or shell out to CLI commands.
Future hosted/server read edges can call the same viewer service if they need
the local viewer contract.

Follow-up test:
Add an architecture test once more server/integration modules exist: server
routes may import app/service request and response models, but must not import
index store modules or wiki document parsers directly.

## 2026-06-29 - Index Freshness Is Not Forced Reindex

Old hypothesis:
Read commands could force a full `.almanac/index.db` rebuild on every
`ensure_fresh` call because the index is a derived local projection and
correctness mattered more than cost during the early read-model slices.

New hypothesis:
`ensure_fresh` should be stale-aware. It may refresh the derived projection
silently, but it should skip SQLite writes when the source wiki signature is
unchanged. `reindex` is the explicit command for a forced projection rebuild.

Evidence that forced the change:
The local `serve` viewer calls several read verbs per browser request. Repeated
overview/search/page traffic made the old force-rebuild behavior a bad default
for long-running local read surfaces. Cosmic Python chapter 12's CQS/CQRS
pressure also separates read adapters from write-side commands.

Code or product assumption affected:
`IndexStore.refresh` owns source-signature comparison and no-op refreshes.
`IndexStore.rebuild` remains the forced path behind `codealmanac reindex`.
`ViewerService` and `server/app.py` must not special-case freshness.

Follow-up test:
Keep the SQLite trigger regression proving unchanged `ensure_fresh` does not
delete/reinsert `pages`, and add a cheaper stat-manifest test only if large-repo
dogfood makes parsing cost visible.

## 2026-06-29 - Public Jobs, Internal Runs

Old hypothesis:
The Python rewrite might rename the public lifecycle inspection surface from
`jobs` to `runs` because `runs` is the service named in the live agreement.

New hypothesis:
Keep public `jobs` as the CLI noun and use internal `runs` as the service noun.
Users inspect jobs; workflows record runs. This avoids a user-facing rename
while still giving the Python code a service that owns execution records,
events, outputs, and lifecycle state.

Evidence that forced the change:
The live agreement lists `codealmanac jobs` as the public CLI command and names
`runs` as the service owner. The old lifecycle wiki also says `jobs` is the
durable queued-work term while recurring scheduled intent belongs to
automation. Cosmic Python chapter 10 made the split cleaner: starting work is a
command, while run-log entries are facts.

Code or product assumption affected:
`services/runs` owns `.almanac/jobs/` records and logs. `cli/main.py` exposes
that service as `codealmanac jobs`, `jobs show`, and `jobs logs`.

Follow-up test:
When foreground/background execution lands, workflows should call
`app.runs.start`, `app.runs.record_event`, and `app.runs.finish` directly
instead of shelling out to `codealmanac jobs`.

## 2026-06-29 - Source Inputs Are Boundary Messages

Old hypothesis:
The next lifecycle slice might start with a public `ingest` command and fill in
the source model as command parsing needed it.

New hypothesis:
Add `services/sources` first. Raw user inputs are external boundary messages
that should become typed `SourceAddress`, `SourceRef`, and `SourceBrief` values
before workflows or agents see them. The public `ingest` command should wait
until an ingest workflow can honestly start or run lifecycle work.

Evidence that forced the change:
The live agreement says `sources` owns observations, refs, fingerprints, and
local source state, while workflows own update verbs. The `evidence-bundles`
wiki page also distinguishes operation input from page provenance and rejects
durable candidate objects. Cosmic Python chapter 11 frames outside messages as
edge inputs that should be translated before entering the core.

Code or product assumption affected:
`app.sources.resolve(...)` is the source-input boundary. It may classify local
paths, GitHub refs, URLs, git refs, and transcript refs, but it does not write
pages, start runs, fetch external systems, or decide notability.

Follow-up test:
When `workflows/ingest` lands, test that it consumes `SourceBrief` values from
`SourcesService` and records the selected source refs in the run ledger without
letting CLI parsing become the workflow boundary.

## 2026-06-29 - Web URLs Are Runtime Material, Not A Source Library

Old hypothesis:
Generic web URLs might require a separate discovery or source-library shape
because they can represent external documents outside the repo.

New hypothesis:
For Python v1, web URLs are selected run input that fit the existing
`SourceRuntimeAdapter` seam. The adapter fetches and normalizes readable
material; Ingest still decides nothing about notability until the harness sees
the prompt.

Evidence that forced the change:
The live agreement says source input has the same
`SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` layers for Git,
GitHub, transcripts, and web. The existing Ingest workflow already consumes
source runtime snapshots without knowing source kinds. Cosmic Python chapter 11
keeps outside messages at the edge, and chapter 13 keeps concrete external
dependencies wired through the composition root.

Code or product assumption affected:
`integrations/sources/web/` owns HTTP and HTML/text parsing. `services/sources`
keeps only the product-owned ref/runtime contract. No `collect`, `capture`,
hosted upload, durable candidate, crawler, or web source catalog is introduced.

Follow-up test:
Keep an ingest workflow test where a real `WebSourceRuntimeAdapter` with
`httpx.MockTransport` feeds web runtime text into the prompt, and dogfood a real
public URL with a fake harness before committing the slice.

## 2026-06-29 - Path Refs Need Runtime Material

Old hypothesis:
Local path refs could start as observations: existence, kind, absolute path, and
file fingerprint. The harness could use tool access to read a selected file if
it needed more.

New hypothesis:
Path file and directory refs should produce bounded `SourceRuntime` snapshots
before the harness runs. A lifecycle prompt should include the selected local
material directly instead of forcing the writer to infer which files to read
from metadata.

Evidence that forced the change:
The product contract says `ingest <inputs...>` uses selected local material as
source material. Tests showed `note.md` ingest previously produced a skipped
runtime snapshot even though the user explicitly selected that file. The
existing source-runtime port already handles Git, GitHub, transcripts, and web
without changing Ingest.

Code or product assumption affected:
`integrations/sources/filesystem/` owns filesystem reading, directory filtering,
text decoding, and prompt-friendly rendering. `services/sources` keeps the
product contract. `workflows/ingest` remains source-kind agnostic.

Follow-up test:
Keep the ingest workflow test that proves a selected `note.md` reaches the
prompt as available runtime content, and dogfood local file plus directory
inputs through a temp repo before committing the slice.

## 2026-06-29 - Update Is Package-Manager Policy, Not NPM Plumbing

Old hypothesis:
The Python port could leave `codealmanac update` pending until the rest of the
local product surface was complete.

New hypothesis:
`update` should land as a conservative service-owned command now because the
live CLI contract includes it, but it should not inherit the npm-era notifier
or installer assumptions from the archived TypeScript code.

Evidence that forced the change:
`uv run codealmanac --help` did not list `update` even though the live agreement
does. The current development install reports `INSTALLER=uv` and an editable
`direct_url.json`, which proves that a naive self-update would mutate the wrong
thing. uv and pip expose different update commands, so package-manager choice
must be explicit metadata-driven policy.

Code or product assumption affected:
`services/updates` owns the update plan and supported methods. The concrete
adapter under `integrations/updates/` reads package metadata and runs the chosen
foreground command. Editable/source installs are unsupported for mutation and
report `git pull && uv sync`.

Follow-up test:
Dogfood `codealmanac update --check` and default `codealmanac update` in the
editable repo. Add real non-editable `uv tool` and pip install dogfood before
scheduling update automation.

## 2026-06-29 - Harnesses Are Ports Before Adapters

Old hypothesis:
The next lifecycle slice might connect source refs directly to an `ingest`
workflow.

New hypothesis:
Add `services/harnesses` first. `ingest`, `sync`, and `garden` need a
normalized agent task/result/readiness contract before they can call Codex or
Claude without importing concrete adapters.

Evidence that forced the change:
The live agreement says harnesses own normalized Codex/Claude contracts and
ports, while integrations implement those ports. Cosmic Python chapter 4 keeps
use cases out of entrypoints, and chapter 13 keeps wiring in the composition
root.

Code or product assumption affected:
`app.harnesses.run(...)` is now the port-backed service call workflows will use
for agent execution. `cli/main.py` remains uninvolved in agent task execution.

Follow-up test:
When concrete Codex or Claude adapters land, add an architecture test that CLI
modules do not import `integrations/harnesses/*` and workflows only depend on
`services/harnesses`.

## 2026-06-29 - Ingest Is A Command, Run Logs Are Events

Old hypothesis:
The next step might expose a public `codealmanac ingest` command once source and
harness seams existed.

New hypothesis:
Add `workflows/ingest` internally first. It can prove the orchestration between
sources, harnesses, runs, and the index, but public CLI should wait for a real
harness adapter so the command does actual lifecycle work.

Evidence that forced the change:
The live agreement says CLI commands are not internal APIs and shows
`app.workflows.ingest.run(...)` as the correct app surface. Cosmic Python
chapter 10 also distinguishes commands, which fail loudly, from events, which
record past facts.

Code or product assumption affected:
`RunIngestRequest` is a command and raises on missing harnesses, unsafe changed
files, or failed harness statuses. `RunsService` records the past-tense facts
around the attempt.

Follow-up test:
When `codealmanac ingest` becomes public, test that the CLI only adapts argv
into `RunIngestRequest` and does not own source parsing, prompt rendering,
harness selection, run finishing, or index refresh.

## 2026-06-29 - Claude Is The First Concrete Harness Adapter

Old hypothesis:
The first concrete harness might need to start with Codex because CodeAlmanac is
used from Codex sessions.

New hypothesis:
Start with Claude CLI because it has a simple non-interactive `--print` JSON
contract. Codex remains important, but the archived implementation shows Codex
needs the app-server path for the richer lifecycle semantics.

Evidence that forced the change:
Local `claude -p --output-format json` returned a structured result, while the
archived Codex provider delegates to the Codex app-server adapter. Cosmic
Python chapter 3 says a useful abstraction hides messy external details; the
Claude adapter can exercise the `HarnessAdapter` port without importing
provider details into workflows.

Code or product assumption affected:
`create_app()` now wires `ClaudeCliHarnessAdapter` by default. CLI, services,
and workflows are guarded by an architecture test that forbids direct imports
from `codealmanac.integrations`.

Follow-up test:
Before public `codealmanac ingest`, add stronger dirty-worktree or sandbox
preflight so a real provider run cannot silently change application code.

## 2026-06-29 - Git Snapshot Policy Before Public Ingest

Old hypothesis:
The Claude adapter's `changed_files` output plus workflow validation might be
enough to make real-provider ingest safe.

New hypothesis:
The workflow needs its own mutation policy around every harness run. Adapter
reported changes are diagnostic, but product safety must use a provider-neutral
before/after snapshot.

Evidence that forced the change:
The Claude adapter can only report changes it observes through its own Git
status delta. If application code is already dirty before ingest, a provider
could mutate that same path without creating a new status entry. Cosmic Python
chapter 6 frames a Unit of Work as a stable snapshot around an operation; for
filesystem writes, Git snapshots are the honest audit boundary.

Code or product assumption affected:
`workflows/ingest` now runs `IngestMutationPolicy` before and after harness
execution. `.almanac/` must be clean before the run, pre-existing dirty app
files are allowed, and any non-wiki mutation during the run fails the job.

Follow-up test:
Before public CLI ingest, add a real CLI smoke over a Git repo once the command
exists, and decide whether failure should offer a one-line fix such as
committing or stashing `.almanac/` changes.

## 2026-06-29 - Public Ingest After Safety, Before Codex Parity

Old hypothesis:
Public `codealmanac ingest` might wait until both Claude and Codex adapters
exist, so the command does not expose an incomplete provider matrix.

New hypothesis:
Expose public ingest once the workflow has source contracts, run records, a
real Claude adapter, and mutation safety. Codex parity can land as a provider
slice later because the CLI already targets the provider-neutral `HarnessKind`
contract.

Evidence that forced the change:
The live agreement lists `codealmanac ingest <inputs...>` in the v1 CLI
contract. Slice 15 made real-provider mutation safe enough to expose locally.
Cosmic Python chapter 10 also keeps the command as intent: the CLI sends
`RunIngestRequest`, while the workflow remains the handler.

Code or product assumption affected:
`cli/main.py` now exposes `ingest` with `--using claude|codex`, `--wiki`,
`--title`, and `--guidance`. The CLI prints a short result summary and does
not own source parsing, prompt rendering, harness execution, mutation safety,
runs, or index refresh.

Follow-up test:
When the Codex adapter lands, add one CLI test that `--using codex` reaches the
adapter without changing the CLI command shape.

## 2026-06-29 - Codex CLI Adapter Before App-Server

Old hypothesis:
The Python rewrite might need to port the archived TypeScript Codex app-server
adapter before `--using codex` could be real.

New hypothesis:
Use `codex exec` for Python v1 and defer app-server until the harness contract
needs streaming events, provider usage telemetry, structured tool display,
programmatic subagents, or richer provider lifecycle control.

Evidence that forced the change:
Current `codex exec` supports stdin prompts, `--ephemeral`, workspace
sandboxing, config overrides, and `--output-last-message`. The current
`HarnessAdapter` contract needs readiness, one prompt run, final text, status,
and changed files. A real `codex exec` smoke returned `ok`, and real
`codealmanac ingest note.md --using codex` dogfood created one wiki page in a
temp repo.

Code or product assumption affected:
`integrations/harnesses/codex/adapter.py` is a CLI adapter. Shared subprocess
and Git-status helpers live in `integrations/harnesses/`, not under Claude.
The archived app-server modules remain behavior reference for future richer
harness requirements, not a shape to preserve now.

Follow-up test:
If a later slice adds streaming job attach, usage accounting, structured
output schemas, or provider-owned subagents to the Python harness contract,
reopen the app-server path and add fake-protocol tests before changing
`CodexCliHarnessAdapter`.

## 2026-06-29 - Garden Uses Wiki State, Not Source Inputs

Old hypothesis:
The next lifecycle operation might reuse most of Ingest directly because both
operations ask a harness to update `.almanac/`.

New hypothesis:
Garden should be a separate workflow over wiki state. It shares prompt
doctrine, harness execution, run logging, index refresh, and mutation safety,
but it does not consume `SourceBrief` values or preserve a selected-source
boundary.

Evidence that forced the change:
The live agreement and lifecycle wiki describe Garden as whole-graph
maintenance: topics, links, stale pages, boundaries, hubs, and no-op judgment.
That is different from Ingest, which starts from bounded selected material.
The first implementation stayed clean once prompt rendering and mutation
safety were shared below the operation workflows.

Code or product assumption affected:
`workflows/garden` receives index and health context. `workflows/ingest`
receives selected source briefs. Both use `PromptRenderer`,
`HarnessesService`, `RunsService`, and `LifecycleMutationPolicy`.

Follow-up test:
If `sync` lands next, keep discovery separate from both operations: Sync may
select material and call Ingest, but it should not become another prompt-writing
workflow unless product behavior requires it.

## 2026-06-29 - Sync Status Before Sync Execution

Old hypothesis:
The next sync slice could discover quiet local transcripts and immediately run
ordinary local ingest for ready material.

New hypothesis:
Expose `codealmanac sync status` first. It should discover transcripts, map
them to `.almanac/` repos, apply quiet-window and cursor checks, and report
readiness without writing the wiki or starting ingest.

Evidence that forced the change:
Ingest and Garden now create provider transcripts through Claude and Codex
harness runs. The current `HarnessRunResult` and `RunRecord` do not store the
provider session id or transcript path, so sync execution cannot yet exclude
CodeAlmanac's own lifecycle transcripts reliably. Cosmic Python chapter 13 also
keeps the concrete transcript scanners behind `app.py` composition instead of
letting CLI import them directly.

Code or product assumption affected:
`workflows/sync` owns cursor evaluation and quiet-window status. `sources`
owns transcript discovery ports and typed candidates. Full `codealmanac sync`
execution remains gated until harness runs feed provider transcript identity
back into the run ledger.

Follow-up test:
When sync execution lands, add a regression where an Ingest or Garden provider
run creates a transcript and `codealmanac sync` skips that internal transcript
while still reporting a separate user transcript from the same repo as ready.

## 2026-06-29 - Transcript Feedback Before Sync Skip Policy

Old hypothesis:
Full sync execution could add internal-transcript exclusion and ingest queuing
in one slice.

New hypothesis:
Add harness transcript feedback first. Provider adapters should return a typed
`HarnessTranscriptRef` when they can identify the session they created, and
`runs` should persist that ref before the lifecycle run reaches a terminal
state.

Evidence that forced the change:
Sync status already discovers transcript candidates. The missing information is
not in sync; it is in the lifecycle runs that create internal provider
transcripts. Claude exposes a structured `session_id`; Codex requires a
best-effort local session lookup because `codex exec --output-last-message`
does not include the run id in its final message.

Code or product assumption affected:
`HarnessRunResult` now owns optional provider transcript identity.
`RunRecord` persists it as `harness_transcript`. Future sync execution can
compare discovered candidates against run records without parsing provider
output text or lifecycle logs.

Follow-up test:
Before public `codealmanac sync` runs ingest, add a sync test that creates a
run record with `harness_transcript` and verifies the matching discovered
transcript is skipped while a different transcript remains ready.

## 2026-06-29 - Internal Transcript Exclusion Belongs In Sync Status First

Old hypothesis:
Internal lifecycle transcript exclusion could be added alongside the first
write-capable `codealmanac sync` command.

New hypothesis:
Add the exclusion to `sync status` first. Status is the read-only form of sync
eligibility, so it should already hide transcripts that live sync must never
ingest.

Evidence that forced the change:
Slice 20 gave run records the provider transcript identity needed for the
filter. Adding the filter before execution keeps CLI thin and avoids a future
split where status and live sync disagree about what is eligible.

Code or product assumption affected:
`SyncWorkflow` now reads repo-local run records through `RunsService` and skips
candidates whose provider kind matches and whose session id or transcript path
matches a stored `RunRecord.harness_transcript`.

Follow-up test:
When live `codealmanac sync` lands, assert that it uses the same internal skip
rule before it queues Ingest and records pending cursor state.

## 2026-06-29 - Foreground Sync Commits Cursor After Ingest

Old hypothesis:
The first write-capable sync slice should record pending cursor state before
invoking Ingest, mirroring the archived TypeScript background sweep.

New hypothesis:
For the Python port's current foreground lifecycle shape, `sync` should advance
the ledger only after `IngestWorkflow.run(...)` succeeds. Pending cursor state
belongs with a background runner and a reconciliation loop, neither of which
exists yet.

Evidence that forced the change:
Cosmic Python chapter 6 frames Unit of Work as the boundary for atomic
operations and recommends explicit commits after success. A foreground sync
command already knows whether Ingest succeeded, so writing a pending cursor
beforehand would create stale state on process death without a real pending
owner to reconcile.

Code or product assumption affected:
`SyncWorkflow.run(...)` reuses the same evaluation gates as `status(...)`, calls
Ingest with a `transcript:<path>` source and cursor guidance, then writes the
sync ledger after each successful Ingest. Failed Ingest attempts mark the
ledger entry `failed` and appear in `needs_attention`.

Follow-up test:
When background jobs land, introduce pending cursor fields and reconcile them
against durable run records before scheduled automation uses sync unattended.

## 2026-06-29 - Automation Is Scheduler State, Not Sync Ownership

Old hypothesis:
The next automation slice might need to port the archived TypeScript background
sync pending model before installing scheduled jobs.

New hypothesis:
Install/status/uninstall can land first if automation only owns scheduler
state. The scheduled sync job invokes the foreground `sync` workflow; it does
not own transcript eligibility, cursor mutation, pending runs, or wiki writes.

Evidence that forced the change:
Slice 22 made foreground sync safe by committing the cursor only after Ingest
succeeds. Cosmic Python chapter 13 points dependency construction to the
composition root, so the scheduler should be an injected adapter behind an
automation port rather than a CLI helper or sync dependency.

Code or product assumption affected:
`services/automation` owns `AutomationTask`, `ScheduledJob`, and
install/status/uninstall requests. `integrations/automation/scheduler/launchd`
owns plist serialization and launchctl calls. `app.py` wires the launchd
adapter; tests inject fake schedulers.

Follow-up test:
If scheduled sync needs pending state, add a background owner and reconciliation
tests before changing the sync ledger model.

## 2026-06-29 - Source Runtime Comes After Source Briefs

Old hypothesis:
`SourceBrief` metadata and prompt hints might be enough for Git and GitHub
source-aware Ingest because the agent can inspect the repository itself.

New hypothesis:
Source-aware Ingest needs an explicit `SourceRuntime` layer. The brief names
the selected source and provenance hint; runtime snapshots carry bounded
readable material gathered before model execution.

Evidence that forced the change:
The `evidence-bundles` wiki page records the intended local path as
`SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime -> AbsorbRequest`.
The Python port had the first three layers, but `git:diff` and `git:range`
only reached the prompt as identifiers. Cosmic Python chapter 13 supports a
proper adapter boundary for multi-operation external dependencies.

Code or product assumption affected:
`services/sources` now owns `SourceRuntime` and `SourceRuntimeAdapter`.
`integrations/sources/git` implements local Git runtime snapshots through the
Git CLI. `IngestWorkflow` renders source runtime alongside source briefs.

Follow-up test:
Add GitHub PR/issue source runtime through the same port and test that a PR ref
does not become a one-off Ingest prompt branch.

## 2026-06-29 - GitHub Runtime Is A Local Adapter, Not Hosted Capture

Old hypothesis:
GitHub source refs could stay as prompt hints until a hosted GitHub integration
exists.

New hypothesis:
Local v1 should read GitHub PR and issue material through `gh` behind
`SourceRuntimeAdapter`. The adapter turns `gh --json` output into Pydantic
models and renders bounded source text before the harness starts.

Evidence that forced the change:
`github:pr` and `github:issue` were already valid selected source refs, but
Ingest only supplied their identifiers to the agent. GitHub CLI is available in
the local environment, accepts PR and issue URLs, returns structured JSON for
`view`, and returns PR patch text through `pr diff --patch --color never`.

Code or product assumption affected:
`integrations/sources/github` is now a peer of `integrations/sources/git`.
Both implement the same source-runtime port. Ingest remains source-kind neutral,
and hosted GitHub app behavior remains out of scope.

Follow-up test:
If GitHub runtime needs review threads, checks, linked issues, or pagination,
extend the GitHub adapter contract and tests before changing Ingest.

## 2026-06-29 - Transcript Runtime Belongs Behind Source Runtime

Old hypothesis:
Foreground `sync` could pass transcript paths plus cursor guidance and trust
the harness to inspect the transcript file itself.

New hypothesis:
`transcript:<path>` should produce a bounded `SourceRuntime` snapshot before
the harness starts. Sync still owns transcript eligibility and cursor state;
the transcript adapter owns local JSONL reading and provider-shape translation.

Evidence that forced the change:
Foreground sync already passes `transcript:<absolute path>` into Ingest, but
those files often live outside the repo. Codex sandboxing and future hosted
workers should not depend on direct provider transcript filesystem access after
the harness starts.

Code or product assumption affected:
`integrations/sources/transcripts` now implements both discovery and runtime
translation. Runtime uses `jsonlines` for JSONL reading, Pydantic models for
known Codex/Claude shapes, and tail truncation because transcripts are
append-only and recent lines usually contain the new sync material.

Follow-up test:
If source runtime needs cursor-aware slicing, extend
`InspectSourceRuntimeRequest` with explicit line or byte bounds instead of
teaching Ingest to parse sync guidance text.

## 2026-06-29 - Viewer File Route Is Graph Navigation

Old hypothesis:
The next viewer hardening slice might read referenced repo files so the local
browser could preview source material.

New hypothesis:
The viewer file route should restore the old `/file?path=...` behavior: list
wiki pages that mention a file or folder reference. It should not read repo
source contents.

Evidence that forced the change:
The current `almanac-serve` wiki page describes `/file?path=src/foo.ts` as
"pages mentioning a file" and says the viewer is a read-only client over the
existing wiki/index primitives. The source runtime system already owns reading
selected local files for lifecycle prompts.

Code or product assumption affected:
`ViewerService.file()` delegates to the index mentions query. `server/app.py`
exposes `/api/file` as a query route. The frontend links page rail file refs to
`#/file/<path>` and renders matching pages.

Follow-up test:
Keep service and server tests that prove file and folder refs use index mention
semantics and that parent traversal is rejected before querying.

## 2026-06-29 - Filesystem Directory Runtime Should Ask Git First

Old hypothesis:
Filesystem directory runtime could use a Python walk plus root `.gitignore`
patterns for v1, then tune only if dogfood showed noise.

New hypothesis:
When the selected directory is inside a Git worktree, the runtime should ask
Git for tracked files plus untracked non-ignored files, then apply
CodeAlmanac's default private/generated skips. The Python/pathspec walk remains
the non-Git fallback.

Evidence that forced the change:
The current adapter only applied root `.gitignore` patterns, while real repos
use nested `.gitignore`, `.git/info/exclude`, and global excludes. Git's
`ls-files --cached --others --exclude-standard` already owns that contract.
Cosmic Python chapter 13 also supports explicit dependency injection here:
the adapter takes a `CommandRunner` rather than hardcoding subprocess mechanics
inside product code.

Code or product assumption affected:
`FilesystemSourceRuntimeAdapter` now has a Git-backed directory listing path
for `SourceKind.PATH_DIRECTORY`. It does not add a new source kind, change
Ingest, or make services aware of Git mechanics.

Follow-up test:
If large directories remain noisy, add ranking or selection rules inside the
filesystem integration after dogfood proves which files are wrong, rather than
teaching Ingest to branch on directory shape.

## 2026-06-29 - Directory Runtime Selection Is Changed-First

Old hypothesis:
After Git listing, deterministic path order might be enough for bounded
directory runtime material.

New hypothesis:
Git-listed directory runtime should rank changed and untracked files before
unchanged files, then fall back to deterministic content/path ordering for the
remaining files. The prompt should show whether an included file was selected
as changed or unchanged.

Evidence that forced the change:
Dogfood against this repo's `src/codealmanac/` directory selected package
markers and broad unchanged modules before the files in the current slice, then
hit the file-count bound. Git's porcelain status format gives a stable
machine-readable changed-file signal for this exact path.

Code or product assumption affected:
`integrations/sources/filesystem` now owns a typed directory-selection policy.
The source service, Ingest workflow, and CLI still see one directory
`SourceRuntime`; there is no durable source-pool or candidate object.

Follow-up test:
If clean large directories remain noisy after changed-first selection, add a
separate semantic-diversity or recency policy with dogfood proving the wrong
unchanged files.
