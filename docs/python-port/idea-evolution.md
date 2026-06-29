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
