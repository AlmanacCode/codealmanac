# Python Port Idea Evolution

Updated: 2026-07-01

Record hypothesis changes here. Do not rewrite history; append a new entry when
evidence changes the shape.

## 2026-07-01 - Topic Commands Need A Graph Boundary

Old hypothesis:
`TopicsService` could own topic command orchestration, workspace selection,
topic existence checks, self-parent validation, and DAG cycle traversal in one
file because all of those behaviors support one CLI command group.

New hypothesis:
`TopicsService` should stay the service-facing use-case entrypoint, while
`services/topics/graph.py` owns topic graph rules,
`services/topics/read_model.py` owns topic slug lookup through the derived
index, and `services/topics/workspace.py` owns selected-wiki resolution.

Evidence that forced the change:
`services/topics/service.py` reached 297 lines and mixed public topic verbs with
mechanical DAG traversal and workspace request construction. Cosmic Python's
service-layer guidance keeps service methods as the entrypoint to use cases,
not as the home for every internal helper those use cases need.

Code or product assumption affected:
Architecture tests now keep `TopicDefinition`, `SelectWorkspaceRequest`, graph
helper definitions, read-model helper definitions, and workspace helper
definitions out of `service.py`.

Follow-up test:
Future topic changes should add behavior tests around the public topic verb and
keep graph traversal tests or architecture checks near `services/topics/graph.py`.

## 2026-07-01 - Index Reads Need Query-Family Modules

Old hypothesis:
The index read side could live in one `services/index/views.py` file because
all functions were read-only SQL over the same derived SQLite model.

New hypothesis:
`views.py` should be a small facade over query-family modules. Search and
file-mention SQL lives in `search_views.py`, summary counts live in
`summary_views.py`, page detail projection lives in `page_views.py`, topic DAG
reads live in `topic_views.py`, and health findings live in `health_views.py`.

Evidence that forced the change:
`views.py` reached 627 lines. The read side now serves search/show/topics,
health, and the local viewer. Those surfaces share a database but have
different reasons to change, especially after structured page `sources:` added
health findings and page provenance projections.

Code or product assumption affected:
Architecture tests now keep `views.py` tiny, require the query-family modules,
keep each read-view module under 260 lines, and prevent migrations,
projection-write SQL, and page-document loading from entering any view module.

Follow-up test:
Future index changes should add behavior tests for the affected public read
surface and keep read-only SQL in the module named for that query family.

## 2026-07-01 - Run Ledger Needs A Transition Writer

Old hypothesis:
`RunStore` could remain one service-facing repository file that owned run paths,
JSON record/spec IO, JSONL event appends, worker locks, queue selection, and
state transitions.

New hypothesis:
`RunStore` should stay the repository facade, but the persistence details need
named modules. `paths.py` owns run-id validation and file naming, `io.py` owns
record/spec/event file mechanics, `locks.py` owns worker locks, and
`transitions.py` owns grouped record-plus-event writes.

Evidence that forced the change:
`store.py` reached 486 lines and the status transitions in `mark_running`,
`finish`, and `cancel` manually wrote the run JSON record and then appended a
matching status event. Jobs attach/cancel, background workers, sync
reconciliation, and viewer job detail all depend on the record and event log
staying coherent.

Code or product assumption affected:
Architecture tests now require the split modules, keep `store.py` under 280
lines, and prevent JSON parsing, path validation, worker lock ownership, and
manual append-file mechanics from moving back into the store facade.

Follow-up test:
Future run-ledger changes should test public `RunsService` behavior, and
transition-level failure tests should keep proving that event append failure
restores the previous record or removes an uncommitted queue spec.

## 2026-07-01 - Filesystem Runtime Is A Small Adapter Plus Modules

Old hypothesis:
The filesystem source-runtime adapter could own path support end to end:
adapter dispatch, text decoding, ignore rules, Git listing, Python walking,
selection, rendering, and path display helpers.

New hypothesis:
`FilesystemSourceRuntimeAdapter` should only implement the service-owned
`SourceRuntimeAdapter` port and assemble `SourceRuntime` values. Text document
decoding, directory material listing, selection ranking, rendering, and path
display are separate filesystem-integration modules.

Evidence that forced the change:
`integrations/sources/filesystem/adapter.py` reached 685 lines and had several
independent reasons to change. The source-runtime contract is stable, but the
inside of the filesystem adapter mixes provider-like Git mechanics,
prompt-facing rendering, document parsing, and directory traversal policy.

Code or product assumption affected:
Architecture tests now require `documents.py`, `listing.py`, `paths.py`,
`rendering.py`, and `selection.py`, keep `adapter.py` under 220 lines, and
prevent charset decoding, pathspec/Git walking, document models, and rendering
helpers from regrowing in the adapter.

Follow-up test:
Future filesystem behavior changes should test the module that owns the
behavior directly, then keep one source-runtime test proving public output.

## 2026-07-01 - Sync Needs A Policy Module

Old hypothesis:
`SyncWorkflow` could own transcript discovery, run reconciliation, ledger cursor
rules, pending-entry transitions, and ingest startup in one service module
because `sync` is one workflow.

New hypothesis:
`SyncWorkflow` should remain the service-layer use case, but deterministic
ledger/cursor policy deserves a first-class module. The service coordinates
sources, runs, queue, ingest, and ledger persistence; `workflows/sync/policy.py`
owns ledger identity, cursor decisions, pending-run reconciliation, and cursor
guidance.

Evidence that forced the change:
`workflows/sync/service.py` reached 693 lines and mixed orchestration with pure
cursor transition rules. The old TypeScript wiki already treated the sync
ledger as the dedupe and recovery contract, not a side detail of the scheduler.
Cosmic Python's service-layer guidance points toward workflows that coordinate
repositories/services while keeping policy rules separately testable.

Code or product assumption affected:
Architecture tests now keep sync cursor helpers out of `service.py` and prevent
`policy.py` from importing orchestration services or integrations.

Follow-up test:
Future sync behavior changes should add focused tests around the policy
function that owns the cursor or ledger transition, plus a workflow-level test
for the public `sync` behavior.

## 2026-07-01 - Viewer Scope Is A Read Model

Old hypothesis:
`serve` could capture one resolved workspace at startup and treat `--wiki` as
the only cross-wiki mechanism.

New hypothesis:
The local viewer needs an explicit read-scope model. `ViewerService` selects the
current or requested workspace, exposes available registered local wikis, skips
unavailable entries without mutating the registry, and lets the browser pass a
stable `workspace_id` selector for detail routes.

Evidence that forced the change:
The live agreement says `serve` should browse all registered local wikis, while
the current FastAPI routes and viewer requests always resolved exactly one
workspace. That made the archive-era multi-wiki scope impossible without
teaching the viewer service about the registry.

Code or product assumption affected:
`ViewerOverview` now carries `workspaces`; `/api/*` viewer routes accept a
`wiki` query selector; `serve --wiki` is a narrowing flag that exposes only the
selected wiki in overview.

Follow-up test:
Keep server/viewer tests that prove default `serve` lists available registered
wikis, skips missing entries, and locked `serve --wiki` returns a single-wiki
overview.

## 2026-07-01 - Page Writing Has One Lifecycle

Old hypothesis:
`ingest` and `garden` could each own their own run ledger, harness, safety, and
failure flow because the workflows were still small enough to read.

New hypothesis:
Page-writing operations need a shared lifecycle workflow. Operation workflows
prepare their own context and prompt; `PageRunWorkflow` owns the repeated run
transition, preflight, harness, normalized event recording, safety validation,
index refresh, and terminal state.

Evidence that forced the change:
`IngestWorkflow` and `GardenWorkflow` duplicated the same harness/run machinery.
The archived Almanac engine already has a page-run workflow for the same
reason, and the Python files had grown large enough that ownership was no
longer obvious.

Code or product assumption affected:
`workflows/page_run/` is now the only place page-writing operations should call
`RunHarnessRequest`, record harness transcripts, translate harness events, and
finish or fail runs.

Follow-up test:
Keep architecture coverage that prevents `ingest` and `garden` from importing
shared harness/run plumbing directly.

## 2026-07-01 - App-Server And Background Jobs Are Active Work Again

Old hypothesis:
Public-beta readiness was close enough that richer Codex app-server support,
Claude SDK events, and queue/worker background jobs could wait for later
evidence.

New hypothesis:
The active rewrite goal is no longer just public-beta packaging. Restoring the
archived behavior means bringing back rich harness events and background job
machinery in Python shape before calling the architecture good enough.

Evidence that forced the change:
The user explicitly reopened architecture quality work and named Codex
app-server, Claude SDK/event harnesses, background jobs, attach/cancel, and
durable run events as required restoration targets.

Code or product assumption affected:
`codex exec` is a temporary adapter, not the final Codex lifecycle path.
Foreground `sync` pending claims remain useful, but they do not replace the
background queue/worker surface now required by the active goal.

Follow-up test:
When those slices land, add behavior tests for attach/cancel/run-event replay
and provider tests that prove rich normalized events survive into `jobs logs`.

## 2026-07-01 - Cancellation Is Run State

Old hypothesis:
Background jobs should probably start with a queue and worker, because that is
the most visible missing machinery from the archived implementation.

New hypothesis:
The queue and worker need a stable control contract first. `cancel` must be
durable run state, `attach` must read the durable event stream, and terminal
finalization must not overwrite cancelled records.

Evidence that forced the change:
The archive's worker, finalization, and CLI all depended on cancellation being
visible in storage before and after execution. The current Python code could
finish a run after any external actor marked it cancelled because `finish(...)`
did not re-check terminal cancellation.

Code or product assumption affected:
`RunStore.finish(...)` now preserves `cancelled`; `RunsService.cancel(...)`
owns cancellation; `jobs cancel` no longer needs storage knowledge; and future
background workers should use the same service/store behavior instead of
inventing a separate cancellation marker path.

Follow-up test:
The worker slice should prove that queued cancellation prevents execution and
running cancellation cannot be rewritten by finalization.

## 2026-06-29 - Public Release Is A Gate, Not A Feeling

Old hypothesis:
After the local product surface existed, the remaining question was mostly
whether more architecture polish was worth it.

New hypothesis:
Architecture-only work is now diminishing returns. Public release should be
judged by concrete evidence: clean install, accurate README and package
metadata, real lifecycle dogfood, prompt quality, sync proof, viewer browser
checks, safety checks, and contract guards.

Evidence that forced the change:
`README.md` still advertised the old Node/npm `almanac` and hosted-dashboard
flow after the Python CLI had moved to `codealmanac`, Python 3.12+, local-only
behavior, and a default `almanac/` root.

Code or product assumption affected:
The release bar now lives in `docs/python-port/public-release-readiness.md`.
Public-contract tests check package README/license metadata and reject stale
README install language.

Follow-up test:
Keep the README contract test and run a clean wheel install dogfood before any
public release claim.

## 2026-06-29 - Transcript Visibility Belongs To Harness Events

Old hypothesis:
`HarnessTranscriptRef` plus one harness output log line might be enough for
local lifecycle auditability.

New hypothesis:
The durable CodeAlmanac contract is a normalized harness event stream. Provider
transcript identity is useful for sync exclusion and debugging, but run logs
should not depend on raw Claude or Codex transcript file shapes.

Evidence that forced the change:
The user wants to see actual transcripts through a normalized harness surface.
`codex exec` can still serve v1 one-shot wiki updates, but it does not expose
the same complete text/tool/usage lifecycle surface as Codex app-server.

Code or product assumption affected:
`HarnessRunResult.events` now carries typed `HarnessEvent` values.
`ingest` and `garden` persist those events into `jobs logs`; adapters without
rich events fall back to a terminal `done` event.

Follow-up test:
Keep workflow tests that prove multiple harness events are recorded in order.
Reopen Codex app-server only when real lifecycle dogfood requires event
completeness beyond the current terminal `codex exec` event.

## 2026-06-29 - Harness Results Are Run Facts Before Validation

Old hypothesis:
Lifecycle workflows could record harness output only after mutation safety and
success validation passed, because successful wiki updates were the main
observable outcome.

New hypothesis:
The returned harness result is itself a run-log fact. Workflows should record
its status and first output line before later validation so failed agent work
remains inspectable through `jobs logs`.

Evidence that forced the change:
A failed harness can also mutate a file outside the configured Almanac root.
The terminal run error should remain the mutation-safety violation, but without
an earlier output event the run log loses the direct evidence that the harness
returned `failed`.

Code or product assumption affected:
`ingest` and `garden` now record normalized harness events immediately after
the harness returns and before mutation-safety validation. `validate_harness_result`
still owns the command failure contract.

Follow-up test:
Keep workflow tests that assert failed harness runs record `output` before
terminal `error` for both normal failed status and failed-plus-unsafe mutation.

## 2026-06-29 - Scheduled Sync Is A Command Source

Old hypothesis:
Background sync might need a separate local queue owner or background worker
before automation could be considered safe.

New hypothesis:
For local v1, scheduled sync is a source of foreground `sync` commands. Launchd
starts the CLI, and automation translates its unattended policy into explicit
command fields: `claim_owner`, `pending_timeout`, and `max_failed_attempts`.

Evidence that forced the change:
Foreground sync already writes a pending claim before Ingest and reconciles
terminal linked runs. Adding another queue would duplicate the ledger. The
missing safety was not a worker; it was durable retry policy for repeated
failed attempts.

Code or product assumption affected:
`SyncLedgerEntry.failed_attempts` records failed transcript ingest attempts.
`SyncSelectionRequest.max_failed_attempts` controls exhaustion. Automation
installs scheduled sync with a stable claim owner and explicit retry flags.

Follow-up test:
Keep tests that failed attempts increment, exhausted failed attempts report
`sync-retry-budget-exhausted`, and automation sync argv includes the owner and
retry flags.

## 2026-06-29 - Source Runtime Context Carries Workspace Ignores

Old hypothesis:
Filesystem source runtime could exclude a small list of common wiki roots:
`almanac/`, `docs/almanac/`, and `.almanac/`.

New hypothesis:
The adapter should not know CodeAlmanac root names. Ingest resolves the
workspace, then passes `workspace.almanac_root` in `SourceRuntimeContext`.

Evidence that forced the change:
The product now allows arbitrary repo-relative roots. Adding more global ignore
guesses would make adapter behavior drift from the workspace registry.

Code or product assumption affected:
`InspectSourceRuntimeRequest.context.ignored_directories` is the service-owned
runtime policy. `integrations/sources/filesystem/` applies it for both Git
listing and Python/pathspec walking.

Follow-up test:
Keep coverage for a custom root such as `knowledge/` so directory ingest never
includes the repo wiki as source material.

## 2026-06-29 - Configured Root Is A Workspace Fact

Old hypothesis:
The configurable root decision could be handled as a setup flag and a path
rename from `.almanac/` to `almanac/`.

New hypothesis:
The configured root is a workspace fact. The registry stores the relative root,
`Workspace` exposes both `almanac_root` and `almanac_path`, and downstream
services must receive the workspace object or an explicit path from it.

Evidence that forced the change:
Nested roots such as `docs/almanac/` break assumptions that the repo root is
`almanac_path.parent`. Sync also broke the simpler model because transcript
discovery first maps provider transcript cwd values to a repo and then later
needs the exact wiki root for the sync ledger. A `repo_root` alone is not
enough.

Code or product assumption affected:
`services/workspaces/roots.py` owns root validation and nearest-root discovery.
The registry stores `almanac_root`. Transcript candidates now carry
`almanac_path`. `IndexService` passes the true repo root into health checks.
Prompts/manual/lifecycle errors describe the configured Almanac root instead of
literal `.almanac/`.

Follow-up test:
Keep tests for default `almanac/`, configured `docs/almanac/`, and explicit
`.almanac/`. If arbitrary custom roots matter for directory source runtime,
pass the configured root into that adapter instead of extending hard-coded
ignore lists.

## 2026-06-29 - Configured Almanac Root, Default `almanac/`

Old hypothesis:
The Python rewrite could keep `.almanac/` as the repo-owned wiki artifact
because that matched the TypeScript implementation and the early slices.

New hypothesis:
The Python rewrite targets new CodeAlmanac users, so the repo wiki root should
be configurable and should default to `almanac/`. Users can choose
`docs/almanac/` or `.almanac/`, but `.almanac/` is not the default and should
not be treated as a compatibility requirement.

Evidence that forced the change:
The user clarified that this product is being built for new users, not old
TypeScript-era users, and explicitly asked to stop storing everything in
`.almanac/` by default. The current code and docs still contain many hard-coded
`.almanac/` assumptions, so this must become a first-class workspace/config
boundary rather than a piecemeal rename.

Code or product assumption affected:
`workspaces` owns the configured Almanac root. Build/init, manual
materialization, `index.db`, page paths, topics, runs, sync ledger, config,
viewer routes, safety checks, and prompts must resolve paths through the
workspace root instead of concatenating `.almanac/`.

Follow-up test:
Add root-configuration tests proving a fresh repo defaults to `almanac/`, can
use `docs/almanac/`, and only uses `.almanac/` when explicitly configured.
Architecture tests should reject new hard-coded repo `.almanac/` path joins
outside the workspace root service.

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

## 2026-06-29 - Config Is A Local Defaults Seam, Not A Public Surface

Old hypothesis:
Config could wait because the current CLI defaults were small hardcoded values:
`--using claude` and `--quiet 45m`.

New hypothesis:
Add `services/config` now as a narrow local seam. User and project TOML config
own lifecycle defaults, while CLI flags still win at the command edge. The
service must not add a public `config` command, hosted account settings,
secret management, or environment-source machinery.

Evidence that forced the change:
The live agreement already names `config` as a service, and the implementation
had product defaults split between argparse and automation code. Cosmic Python
chapter 13 points setup and dependency wiring into the composition root rather
than primary entrypoints. Prior-art checks showed `pydantic-settings` and
Dynaconf as the mature Python settings libraries. We chose
`pydantic-settings` because it keeps the existing Pydantic model style while
providing first-class TOML source handling.

Code or product assumption affected:
`ConfigStore` builds a `CodeAlmanacConfig` from
`TomlConfigSettingsSource` values, `ConfigService` chooses project and user
source order, and `cli/main.py` resolves `flag > config` for lifecycle
defaults. Automation keeps a service fallback default but shares the config
constant.

Follow-up test:
Keep the CLI tests proving `ingest` can use configured default harness without
`--using`, and `sync status` can use configured quiet time without `--quiet`.

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
Slice 14 wired `ClaudeCliHarnessAdapter` by default to prove the harness port.
Slice 84 replaced that runtime path with `ClaudeSdkHarnessAdapter` while keeping
CLI, services, and workflows guarded by architecture tests that forbid direct
imports from `codealmanac.integrations`.

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

## 2026-06-29 - Local-Only Public Surface Needs Executable Guards

Old hypothesis:
The live agreement and CLI implementation were enough evidence that v1 has no
hosted commands, aliases, SDK, or MCP surface.

New hypothesis:
The local-only public surface should have a small executable guard because
future agents may add hosted-looking verbs or aliases while porting old
TypeScript behavior.

Evidence that forced the change:
The verification matrix still marked "No hosted CLI/MCP/SDK/aliases" as
pending even after the CLI existed. The old TypeScript and hosted discussions
contain enough `capture`, `absorb`, hosted worker, SDK, and MCP vocabulary that
a text-only agreement is too easy to miss.

Code or product assumption affected:
`tests/test_public_contract.py` now guards `pyproject.toml` scripts, parser
rejection for hosted/alias top-level commands, and absence of `sdk`/`mcp`
Python modules. No production code changed.

Follow-up test:
When a new public command is intentionally added, update the public-contract
test in the same slice so the local-only boundary remains deliberate.

## 2026-06-29 - Manual Is A Support Package, Not A Command

Old hypothesis:
The existing prompt package might be enough to satisfy the prompts/manual
surface until lifecycle dogfood showed more need.

New hypothesis:
The target Python package shape needs a concrete `manual/` package now, but it
should not create a public CLI command. The right boundary is a support
library that bundles doctrine, copies missing files into `.almanac/manual/`,
and lets diagnostics verify that both package and workspace manuals exist.

Evidence that forced the change:
The live agreement's target root includes `manual/`, and the current Almanac
engine separates prompts as the job bootloader from manual files as the
rulebook. The public CLI contract does not include `manual`, so adding a
command would widen the surface without agreement.

Code or product assumption affected:
`ManualLibrary` is wired in `app.py` and injected into `WikiService` and
`DiagnosticsService`. `build` and `init` materialize missing manual files under
`.almanac/manual/`. `doctor` reports manual readiness. Prompts tell lifecycle
agents to read the relevant manual files before editing.

Follow-up test:
If manual files need package-driven updates later, add an explicit local
maintenance policy that distinguishes bundled doctrine updates from user-edited
workspace conventions.

## 2026-06-29 - Sync Needs Pending Claims Before Ingest Side Effects

Old hypothesis:
Foreground `sync` could advance the cursor only after Ingest succeeded or
failed.

New hypothesis:
`sync` needs a durable pending claim before it invokes Ingest. Active pending
claims should skip the transcript range; stale pending claims should surface as
needs-attention; terminal success or failure should clear the pending fields.

Evidence that forced the change:
The sync ledger already had a `PENDING` status, but `SyncWorkflow.run()` never
wrote it before the side-effecting Ingest call. A scheduled foreground sync
that crashed mid-run could leave no durable record of the claimed range.
Cosmic Python chapter 6 frames a Unit of Work as the place to make an atomic
persistence boundary around side effects. Dogfood also showed that raw
transcript paths were not stable enough for ledger keys on macOS, where temp
paths can appear as `/var/...` or `/private/var/...`.

Code or product assumption affected:
`workflows/sync` now owns pending ledger cursor policy. Transcript discovery
adapters still only return typed local transcript candidates, and Ingest remains
the normal wiki-writing workflow. Sync ledger lookup uses normalized transcript
identity instead of treating the raw key string as the only truth.

Follow-up test:
When background execution exists, decide whether stale pending work should
retry automatically, require manual attention, or use a bounded retry policy.

## 2026-06-29 - Run Records Are Lifecycle Consistency Boundaries

Old hypothesis:
Run records could be created as `queued` and then finished as `done` or
`failed` by the foreground workflow.

New hypothesis:
The run record needs an explicit `running` transition before lifecycle side
effects begin. The `runs` service owns that transition and rejects attempts to
restart terminal records.

Evidence that forced the change:
Sync pending claims need future reconciliation against run state. A record that
jumps from `queued` to a terminal state cannot distinguish queued work from
started work after a crash. Cosmic Python chapter 7 frames an aggregate as the
consistency boundary for related state changes; here the run record is that
boundary for lifecycle execution state.

Code or product assumption affected:
`RunsService.mark_running(...)` is now the only path from `queued` to
`running`. Ingest and Garden call it immediately after creating the run record.
The public CLI still exposes `jobs` as the inspection noun.

Follow-up test:
When sync stores pending run ids, reconcile stale pending entries against
`queued`, `running`, and terminal run records instead of treating age alone as
the only signal.

## 2026-06-29 - Sync Pending Claims Need Run Linkage

Old hypothesis:
Pending sync claims could rely on owner/start/range fields plus a stale timeout
until a background worker existed.

New hypothesis:
The pending claim needs to store the Ingest run id and the claimed cursor
snapshot now. `sync status` can then distinguish active linked work from
terminal work that needs reconciliation, and foreground `sync` can reconcile
terminal linked runs before choosing the next transcript range.

Evidence that forced the change:
Slice 36 made run records a lifecycle consistency boundary with
`queued -> running -> terminal` state. Without `pending_run_id`, sync still had
to infer from age even when the local run ledger already knew whether the
claimed Ingest run had finished. Cosmic Python chapter 8's event/message-bus
pattern pushed the split: record the fact in one place, then react to it at the
workflow boundary.

Code or product assumption affected:
`IngestWorkflow` now exposes `start(...)` and `run_with_run(...)` beneath the
unchanged public `run(...)` method. `SyncWorkflow` creates the run, writes the
pending claim with run id and cursor hash/size, and then executes Ingest with
that run. Transcript adapters still do no policy work.

Follow-up test:
When a real background queue exists, add an owner/retry budget that uses the
same pending run linkage instead of adding a second queue ledger.

## 2026-06-29 - Clean Directory Runtime Needs Diversity, Not Recency Yet

Old hypothesis:
Clean large directories might need semantic diversity or recency ranking after
changed-first selection.

New hypothesis:
Use semantic diversity first. Directory runtime should gather candidates from
Git or the Python walk, then use a pure selection function that interleaves
directory groups and prefers role-bearing files such as `service.py`,
`adapter.py`, `app.py`, and `main.py`. Recency stays out until dogfood shows a
freshness-specific failure.

Evidence that forced the change:
Dogfood against clean `src/codealmanac/` selected shallow package files before
the source, workflow, and service owners that explain the repo. Cosmic Python
chapter 3 separates filesystem interrogation from the decision algorithm: the
adapter should gather file candidates, then a functional core should choose the
bounded prompt material.

Code or product assumption affected:
`integrations/sources/filesystem/selection.py` now owns group-diverse ranking.
`FilesystemSourceRuntimeAdapter` still owns Git/walk I/O and file reads. The
source service, Ingest workflow, and CLI still see one directory
`SourceRuntime`; there is no durable source pool or `candidate` object.

Follow-up test:
If a real clean repo still misses the right files, add a failing source-runtime
dogfood case before adding recency or repository-specific ranking.

## 2026-06-29 - Viewer Wikilinks Are Token Rewrites

Old hypothesis:
The local viewer still had a risk that wikilink rewriting might affect code
spans or fenced code blocks.

New hypothesis:
The renderer should treat Markdown parsing as the boundary. `markdown-it-py`
parses the page into tokens, and CodeAlmanac rewrites only inline `text`
tokens. Inline code and fenced code remain raw wiki source text, while link
labels are rendered as escaped text.

Evidence that forced the change:
The current `MarkdownRenderer` already used `MarkdownIt("commonmark")` and
rewrote child tokens only when `token.type == "inline"`. Focused renderer
tests now prove `[[inline-code]]` and fenced `[[fenced-code]]` do not become
links, while a normal text `[[page-link]]` does.

Code or product assumption affected:
`services/viewer/renderer.py` is the sole owner of local viewer Markdown
rendering and wikilink token rewriting. The server adapter and viewer service
do not perform string-level HTML rewrites.

Follow-up test:
If future Markdown extensions add new inline token types, extend renderer tests
before changing the rewrite logic.

## 2026-06-29 - SQLite Mechanics Belong In Database Package

Old hypothesis:
The index store could own SQLite connection setup and schema application
because it is the only SQLite-backed store in the current Python port.

New hypothesis:
`database/` should own connection setup and migration application now, while
`services/index/store.py` keeps the read-model schema and query semantics.

Evidence that forced the change:
The live agreement already names `database/` as the owner of SQLite
connections and migration application. `IndexStore` had accumulated
`sqlite3.connect`, row-factory setup, PRAGMA policy, and schema migration in
the same file as FTS/search/topic/health query behavior. Cosmic Python chapter
2 separates repository behavior from persistence mechanics, and chapter 6
frames transaction/migration setup as infrastructure around repositories.

Code or product assumption affected:
`codealmanac.database` now exposes `connect_sqlite(...)`,
`apply_migrations(...)`, and typed `SQLiteMigration` values. `IndexStore` still
owns the index schema and all read-model SQL. An architecture test rejects
direct `sqlite3` imports outside the database package.

Follow-up test:
If a second durable SQLite store appears, decide whether migrations need a
shared migration catalog or whether each store should continue to supply typed
store-owned migrations to `database.apply_migrations(...)`.

## 2026-06-29 - Serve Visual Port Is Not Hosted Wiki IA

Old hypothesis:
The local viewer could copy more of UseAlmanac's wiki experience after the
visual direction looked useful.

New hypothesis:
Copy the UseAlmanac design language, not the hosted product flow. `serve`
should keep CodeAlmanac's local wiki browsing model: sidebar navigation,
page/topic/search/file-reference graph movement, and read-only repo-owned
pages.

Evidence that forced the change:
The user clarified that the earlier sidebar-oriented CodeAlmanac viewer was
closer to the desired wiki shape. The problem was the visual treatment, not
the local wiki IA. UseAlmanac's hosted search/page flow is not the target for
this local CLI product. The current UseAlmanac page/search presentation should
not be copied back into CodeAlmanac; use the previous sidebar-first local
viewer as the shape reference and apply better design over it.

Code or product assumption affected:
`src/codealmanac/server/assets/` may borrow UseAlmanac colors, shell polish,
account-picker styling, and dashboard chrome. It should not add hosted account
routes, billing/settings surfaces, hosted wording, or the hosted wiki page
list/search UX.

Follow-up test:
Future viewer changes should be checked in browser-harness against desktop and
mobile viewports. A review should explicitly check that search, page reading,
and navigation still feel like the local sidebar wiki, not the current hosted
UseAlmanac wiki surface.

## 2026-06-29 - Static Viewer Needs Modules, Not React Yet

Old hypothesis:
The visual port could stay as one packaged `app.js` file until the viewer
became a React or Next.js app.

New hypothesis:
Apply the frontend boundary now with static ES modules. API calls, hash routes,
shared DOM components, and screen renderers should live in separate package
assets. React, Next.js, Vite, and component libraries remain deferred until
the viewer has complex client state or UI machinery that static modules cannot
carry cleanly.

Evidence that forced the change:
After the UseAlmanac visual port, `app.js` mixed route parsing, HTTP calls,
state wiring, DOM components, and screen renderers. Bulletproof React's
project-structure guidance recommends feature boundaries and direct imports,
and Cosmic Python chapter 3 frames simple abstractions as the way to reduce
coupling to messy details.

Code or product assumption affected:
`server/assets/viewer/` now owns the browser feature modules. The FastAPI
server validates and serves nested package assets through `/assets/{path}`.
`pyproject.toml` explicitly packages `server/assets/viewer/*.js`.

Follow-up test:
If future viewer work adds complex client state, accessible popovers, routing
machinery, or reusable component state, reassess React/Next.js with a failing
maintenance example rather than adding a build step speculatively.

## 2026-06-29 - Update Success Means Completed, Not Definitely Changed

Old hypothesis:
`codealmanac update` could report `updated` whenever the package-manager
command exited 0.

New hypothesis:
The service should report `completed` for exit code 0. It knows the
package-manager command completed, but it does not know from structured data
whether installed files changed.

Evidence that forced the change:
Uv-tool dogfood installed CodeAlmanac from a local wheel, then ran
`uv tool upgrade codealmanac` through the actual `codealmanac update` command.
The command exited 0 and emitted `Nothing to upgrade`. Cosmic Python's
service-layer boundary and this repo's structured-contract rule both push
against scraping package-manager prose to infer a stronger domain fact.

Code or product assumption affected:
`UpdateStatus.UPDATED` became `UpdateStatus.COMPLETED`. The CLI still exits 0
when the foreground package-manager command succeeds and exits non-zero for
unsupported or failed runs.

Follow-up test:
Add scheduled update automation only after update-notification cadence,
dismissal behavior, and release-channel policy are agreed. Do not infer those
from the manual update command.

## 2026-06-29 - Admin CLI Is The First Dispatch/Render Domain Split

Old hypothesis:
`cli/dispatch/root.py` and `cli/render/root.py` could stay broad after the
slice-40 CLI edge split until a larger CLI rewrite happened.

New hypothesis:
Split only the admin edge now. `doctor`, `update`, `jobs`, and `automation`
change for install/status/runtime-administration reasons, while wiki and
lifecycle commands still have enough cohesion to remain in the root modules
until their next concrete pressure.

Evidence that forced the change:
Slice 48 added update install dogfood on top of existing doctor, automation,
and jobs behavior. The root dispatch/render modules had become a mixed admin,
wiki, lifecycle, and viewer adapter. Cosmic Python chapter 4 separates
entrypoint code from use-case orchestration, so this split keeps admin
entrypoint code separate without moving product logic out of services.

Code or product assumption affected:
`cli/dispatch/admin.py` owns admin command request construction.
`cli/render/admin.py` owns admin output. `cli/dispatch/config.py` owns shared
CLI config and duration parsing helpers. Services, workflows, and the app
composition root remain the stable internal API.

Follow-up test:
Architecture tests should keep admin request/result types out of
`dispatch/root.py` and `render/root.py`. Split wiki or lifecycle dispatch only
when a future command change provides a concrete reason-to-change.

## 2026-06-29 - Index Reads Are Views Over A Derived Projection

Old hypothesis:
`services/index/store.py` could own schema, refresh, replacement writes, search,
page reads, topic reads, and health queries as one SQLite store.

New hypothesis:
Keep `IndexStore` as the service-facing facade, but split read-only queries
into `services/index/views.py`. The store owns the projection lifecycle;
views own SQL that retrieves data from the projection and maps rows into
Pydantic view models.

Evidence that forced the change:
`store.py` became the largest Python file and mixed two reasons to change:
freshness/write-projection mechanics and read/query/health shape. Cosmic
Python chapter 12 recommends keeping read-only views separate from
state-changing code even without full CQRS machinery. The local `index.db` is
already a derived read model, so the smaller read-view split fits without
adding a bus, event handlers, or new storage.

Code or product assumption affected:
`services/index/store.py` still owns migrations, source signatures, source
loading, and `replace_documents(...)`. `services/index/views.py` owns
`search_pages(...)`, `get_page_view(...)`, `get_topic_detail(...)`, and
`build_health_report(...)`. `IndexService` and public CLI behavior are
unchanged.

Follow-up test:
Architecture tests should keep `views.py` read-only: no markdown loading,
migrations, or write SQL. Optimize index refresh cost only after large-repo
dogfood proves source-signature parsing is too slow.

## 2026-06-29 - Serve Shell Polish Stays Inside Static Viewer Modules

Old hypothesis:
The remaining serve work might need a larger frontend move, especially after
borrowing UseAlmanac visual language.

New hypothesis:
Keep `serve` as static package data for now. The product correction is not a
React or Next.js trigger; it is a local wiki-reader interaction correction.
The existing `server/assets/viewer` modules can own sidebar active state and
rail polish while `services/viewer` remains the API contract.

Evidence that forced the change:
The live agreement now says the earlier CodeAlmanac sidebar shell is the target
and the current UseAlmanac page/search UX is a non-target reference. The
current static viewer already has separate API, route, component, renderer, and
main modules, so active page/topic rail state is additive.

Code or product assumption affected:
UseAlmanac colors and shell styling remain reference material. Hosted account
routes, hosted wiki search/page list behavior, and a frontend build step remain
out of scope. The viewer route state lives in `viewer/main.js` over existing
hash routes.

Follow-up test:
Use an isolated temporary Chrome profile with explicit `BU_CDP_URL` for future
browser-harness checks if the default Chrome profile requests the manual
remote-debugging Allow click. Do not add React, Next.js, or Vite unless the
static viewer stops fitting real UI complexity.

## 2026-06-29 - Manual Drift Is Diagnostic, Not Self-Healing

Old hypothesis:
The manual package update debt might need a command or build-time overwrite
policy once bundled doctrine changes.

New hypothesis:
Report drift through `doctor` first. A complete workspace manual that differs
from bundled package docs is review work, not an automatic mutation target.

Evidence that forced the change:
`<almanac-root>/manual/` is repo-owned text that agents read before changing
wiki pages. The tool cannot distinguish an intentional local edit from an older
bundled copy without adding a baseline store, and slice 34 explicitly preserved
local manual edits during build/init.

Code or product assumption affected:
`ManualLibrary.workspace_status(...)` now reports changed files alongside
missing files. `DiagnosticsService` treats missing manual files as a problem
fixed by `codealmanac build`, but changed files as informational drift with an
explicit review message. There is still no public `manual` command.

Follow-up test:
Only add replacement machinery if users need a real workflow for accepting
package manual updates. That workflow must preserve local edits explicitly
instead of making `build` destructive.

## 2026-06-29 - Registry Cleanup Is Explicit Local Management

Old hypothesis:
The next pressure after manual drift was more source-runtime selection work,
possibly recency or another ranking layer.

New hypothesis:
Do not add source-runtime ranking machinery yet. The real local-product gap is
registry management: `list` can contain stale temp workspaces from dogfood or
tests, and users need explicit cleanup without read commands mutating registry
state.

Evidence that forced the change:
Real-repo source-runtime dogfood against `src/codealmanac/`,
`src/codealmanac/services/sources/`, and
`src/codealmanac/integrations/sources/filesystem/` selected role-bearing,
directory-diverse files with `listing_source: git` and no changed files. During
that pass, `codealmanac list` exposed many stale temp registry entries and no
JSON/drop management surface.

Code or product assumption affected:
`WorkspacesService` now owns registry status and explicit cleanup use cases.
`codealmanac list --json` exposes `available`, `missing_repo`, and
`missing_almanac`; `list --drop <selector>` removes one selected entry; and
`list --drop-missing` removes unreachable entries only when the user asks.
Plain `list` keeps the established three-column output.

Follow-up test:
Do not add automatic pruning to `search`, `show`, `serve`, `doctor`, or plain
`list`. Add richer registry filtering only if real local wiki management
requires it.

## 2026-06-29 - Real Dogfood Tests Writing Contracts

Old hypothesis:
The next public-release pressure might expose a missing workflow seam or a
need to port Codex app-server sooner.

New hypothesis:
The current service-layer seam is holding. Real lifecycle dogfood is more
likely to expose prompt/manual writing-contract gaps than missing orchestration
machinery.

Evidence that forced the change:
A real `CodexCliHarnessAdapter` ingest run created a useful page under
`almanac/pages/`, preserved non-wiki files, produced readable `jobs logs`, and
was queryable through search/show. The concrete failure was that the writer
used `[[workos]]` and `[[autumn]]` as page links for entities that had no
pages. Health caught this as broken links.

Code or product assumption affected:
The fix belongs in packaged prompts and manual doctrine, not in workflow code.
Page wikilinks are real graph edges. They must target existing pages or pages
created in the same run. Entity names without pages stay plain text.

Follow-up test:
Keep real provider dogfood in the release gate. Add orchestration only when a
real run fails because the service boundary cannot express the needed product
operation.

## 2026-06-29 - Release Risk Is Maintainer-Facing Drift

Old hypothesis:
After final wheel/sdist package rehearsal, the next release pressure was mostly
prompt-quality dogfood and product judgment.

New hypothesis:
Run a maintainer-facing release-surface audit before more dogfood. A stale
release guide can invalidate an otherwise working package by sending the
maintainer down the archived npm path.

Evidence that forced the change:
`RELEASE.md` still described `npm test`, `npm run build`, `npm pack`, npm
dist-tags, `NPM_TOKEN`, and `npm publish` after the repo had moved to Python
packaging, PyPI-style install, and `codealmanac` as the only public command.

Code or product assumption affected:
Release docs are public product surface. `RELEASE.md` now names the Python
release use case directly: pytest, ruff, diff check, `uv build`, `uvx twine
check`, clean wheel/sdist install smoke, and `uvx twine upload`. Public-contract
tests guard the guide and the PyPI metadata.

Follow-up test:
Before any publish attempt, run `uvx twine check dist/*` against freshly built
artifacts and smoke both wheel and sdist from clean Python 3.12 environments.

## 2026-06-30 - Runtime State Does Not Prove Wiki Availability

Old hypothesis:
The public-release pressure after package rehearsal was mostly release review
and prompt-quality dogfood.

New hypothesis:
Keep doing release review, but first fix evidence found by local dogfood:
availability must distinguish initialized wiki source files from derived
runtime state.

Evidence that forced the change:
Running `codealmanac doctor --json` in this checkout with a registered default
`almanac/` root but no built wiki created `almanac/index.db`. The old registry
status then treated the directory as available even though it contained no
source marker pair.

Code or product assumption affected:
`workspaces` now owns a marker-based definition of an initialized Almanac root.
`index` validates that root before opening SQLite, so read and diagnostic
commands cannot create an index-only fake wiki. `doctor` reports a missing
registered root directly and stops before index/manual/health checks.

Follow-up test:
Keep clean-install and real-repo dogfood in the release gate. If future runtime
state moves outside the repo root, preserve this invariant: source wiki markers
identify the wiki; derived state never does.

## 2026-06-30 - Release Docs Must Preserve Source vs Runtime

Old hypothesis:
After marker-based root detection, the remaining release review would likely be
only broad product judgment.

New hypothesis:
Release review still needs small factual pressure tests. Public docs can drift
even when command behavior and package metadata are correct.

Evidence that forced the change:
The README's "What Gets Created" tree listed `config.toml`, `jobs/`, and
`index.db` as peers of the initialized wiki files. A temp `codealmanac init`
created `.gitignore`, `almanac/README.md`, `almanac/topics.yaml`,
`almanac/pages/getting-started.md`, and `almanac/manual/*.md`; it did not
create runtime state.

Code or product assumption affected:
The public docs now separate init scaffold from runtime state. This reinforces
the slice 63 rule that source wiki markers identify the artifact and derived
SQLite/job files are local machine state.

Follow-up test:
Keep public-contract tests close to user-facing claims, not only forbidden
words. When a README section describes command effects, add a guard for the
actual file or command contract.

## 2026-06-30 - Quickstarts Are Executable Use Cases

Old hypothesis:
After the README scaffold tree was fixed, remaining public-doc work was likely
only wording polish.

New hypothesis:
Treat quickstarts as runnable use cases. A public README command sequence is
wrong if it exits successfully but teaches a new user an empty first result.

Evidence that forced the change:
A temp repo initialized with `codealmanac init` returned `# 0 results` for the
README's `codealmanac search "auth"` command. The same starter wiki returned
`getting-started` for `codealmanac search "getting"` and rendered
`# Getting Started` through `codealmanac show getting-started --lead`.

Code or product assumption affected:
The README quickstart now uses a search term that matches the starter wiki.
Public-contract tests guard the quickstart section directly instead of only
checking that the README mentions `codealmanac search`.

Follow-up test:
For future public examples, distinguish runnable quickstart commands from
illustrative daily-use commands. Runnable examples should be dogfooded in a
fresh temp repo.

## 2026-06-30 - Public Examples Should Hit Product Abstractions

Old hypothesis:
After the quickstart fix, the next release-surface risk was probably another
full install smoke.

New hypothesis:
Keep checking README examples against the product abstractions they describe.
Parser-valid examples can still teach the wrong thing when they resolve as
missing source material.

Evidence that forced the change:
The README lifecycle example `codealmanac ingest docs/adr.md --using codex`
parsed, but `SourcesService.resolve(...)` classified `docs/adr.md` as
`path.unknown` in this checkout. `README.md` resolves as a real `path.file`,
and `github:pr:123` resolves as `github.pull_request`.

Code or product assumption affected:
Public-contract tests now parse the lifecycle examples and call
`SourcesService` for documented source refs. The README local-file ingest
example now uses `README.md`.

Follow-up test:
When public docs describe source inputs, use source-resolution tests rather
than only forbidden-word checks. This keeps examples aligned with the current
source grammar and runtime expectations.

## 2026-06-30 - Continuation Briefs Need Executable Freshness

Old hypothesis:
The next-agent brief could be kept current through the normal steering-doc
habit.

New hypothesis:
The next-agent brief is load-bearing enough that freshness needs a cheap test.
If it lags the slice trail, future agents can resume from a stale checkpoint
even when the worklog and verification matrix contain the newer facts.

Evidence that forced the change:
After slice 66 landed, `docs/python-port/next-agent-brief.md` still described
slice 62 as the latest implementation slice. The rest of the steering trail had
advanced, so the problem was the recovery summary itself.

Code or product assumption affected:
Public-contract tests now discover the highest
`docs/python-port/slice-N-*.md` number and require the brief's current-state
section to mention it. This keeps the long-running goal recoverable after
compaction.

Follow-up test:
Future slices that add a new slice note must update the next-agent brief before
`tests/test_public_contract.py` passes.

## 2026-06-30 - Public Beta Gate Needs An Audited Outcome

Old hypothesis:
The next useful pressure test was "release review against the public beta gate,"
but the result could live in the readiness doc and worklog.

New hypothesis:
The public beta gate needs its own audit artifact with one status, one evidence
summary, and one remaining-risk statement per gate. Otherwise future agents keep
re-deciding what "release review" means.

Evidence that forced the change:
`public-release-readiness.md` had a clear gate table and evidence list, but did
not classify each gate as ready, needing final rerun, or needing more dogfood.
The actual remaining work was discoverable only by reading several slice notes.

Code or product assumption affected:
`docs/python-port/public-beta-gate-audit.md` now records the current release
judgment. Public-contract tests compare the audit's gate areas against the
release gate's gate areas, so adding or changing a gate requires updating the
audit.

Follow-up test:
Before any publish attempt, rerun the package rehearsal from current HEAD and
run one more real lifecycle dogfood pass against a non-toy project source
shape.

## 2026-06-30 - Package Proof Is Now Current-Head Evidence

Old hypothesis:
Public beta still needed current-head package rehearsal and real lifecycle
dogfood before the gate audit could move forward.

New hypothesis:
Current-head package rehearsal is now complete. The remaining product blocker
is prompt-quality dogfood against a non-toy source shape.

Evidence that forced the change:
Slice 69 built current-head wheel and sdist artifacts, passed `twine check`,
inspected wheel/sdist package data, installed both artifacts into clean
uv-managed Python 3.12.9 environments, ran installed read-path and serve smoke,
and checked installed `update --check`.

Code or product assumption affected:
`public-beta-gate-audit.md` now marks `Fresh install` and `Package metadata`
ready. Public-contract tests guard those rows so the audit cannot keep claiming
the package rerun is missing after slice 69.

Follow-up test:
Run one real lifecycle dogfood pass against a non-toy project source shape and
judge the produced wiki diff, links, topics, health, and `jobs` readability.

## 2026-06-30 - User State Belongs To `.codealmanac`

Old hypothesis:
The Python rewrite could keep using `~/.almanac/` for global registry and user
config while moving the repo-owned wiki root to `almanac/`.

New hypothesis:
The repo-owned wiki root remains `almanac/`, but global user state belongs under
`~/.codealmanac/`. The hidden user-state directory is product machinery, not the
repo wiki artifact.

Evidence that forced the change:
The slice 70 real lifecycle dogfood needed real `HOME` so Claude auth was
visible. With real `HOME`, the Python CLI read this machine's old
`~/.almanac/config.toml`, which contained stale `[agent]` config from a previous
product shape and failed strict Pydantic validation. The Python rewrite is not
backward-compatible, so accepting the stale config would preserve the wrong
contract.

Code or product assumption affected:
`AppConfig()` now defaults registry and config paths to `~/.codealmanac/`.
Automation logs use the same product-specific state directory. Public docs say
the repo wiki root is `almanac/` and user/global state is `~/.codealmanac/`.

Follow-up test:
Public-contract tests pin default `AppConfig()` paths and reject old
`~/.almanac` README language.

## 2026-06-30 - Non-Toy Lifecycle Dogfood Clears The Beta Blocker

Old hypothesis:
Public beta still needed one more lifecycle dogfood pass against a non-toy
source shape to judge prompt quality.

New hypothesis:
The current lifecycle prompt/write path has enough public-beta evidence. More
dogfood remains useful, but it is no longer an implementation blocker.

Evidence that forced the change:
Slice 70 ran real Claude-backed `codealmanac ingest` against a temp repo
containing CodeAlmanac source-runtime, filesystem adapter, ingest workflow,
prompt, and live-agreement files. The run created `source-runtime-flow.md`,
health was clean, and job logs were readable.

Code or product assumption affected:
`public-beta-gate-audit.md` now marks the lifecycle write path ready. Remaining
public-release work is release operations: version, changelog, PyPI credentials,
and the human publish decision.

Follow-up test:
Rerun package/install smoke if package metadata, README, prompts, manual docs,
or server assets change before publish.

## 2026-06-30 - Package Proof Must Follow State Path Changes

Old hypothesis:
After slice 70, the implementation gates were covered and release operations
were next.

New hypothesis:
Because slice 70 changed README metadata and installed default state behavior,
package proof needed one more current-head rerun before the implementation
could be treated as complete.

Evidence that forced the change:
The package audit itself says package/install smoke should be rerun when README,
package data, or installed behavior changes before publishing. Slice 70 changed
README package metadata and moved default registry/config paths to
`~/.codealmanac/`.

Code or product assumption affected:
Slice 71 built fresh wheel/sdist artifacts, installed each into clean Python
3.12.9 environments, and proved installed `init` writes
`~/.codealmanac/registry.json` without creating `~/.almanac/registry.json`.

Follow-up test:
Only rerun package smoke again if package metadata, README, prompts, manual
docs, server assets, or installed behavior changes before publish.

## 2026-06-30 - Wiki Detection Requires Source Markers, Not README

Old hypothesis:
A configured Almanac root could be considered initialized when it contained any
one marker: `README.md`, `topics.yaml`, or `pages/`.

New hypothesis:
An initialized CodeAlmanac wiki requires both `topics.yaml` and `pages/`.
`README.md` is useful guidance, but it is too generic to identify a wiki.

Evidence that forced the change:
Running diagnostics from this repo resolved `/Users/rohan/Desktop/Projects` as
the workspace because that directory has a sibling `almanac/` project folder
with a `README.md`. That made a separate project look like the default
`almanac/` wiki root for the parent directory.

Code or product assumption affected:
Root detection, transcript discovery, registry availability, README language,
the bundled manual, and contributor fixtures now use `topics.yaml + pages/` as
the source marker pair. The repo root remains configurable; the marker rule
applies inside whichever root was configured.

Follow-up test:
Keep a regression test where `Projects/almanac/README.md` exists beside
`Projects/codealmanac/`; resolving from `Projects/codealmanac/` must not
register `Projects` as a wiki workspace.

## 2026-07-01 - Architecture Quality Reopens Before Release

Old hypothesis:
After slice 71, implementation work was effectively complete and the next work
was release operations.

New hypothesis:
The active goal is to keep improving the Python architecture while implementing
the missing behavior until further cleanup is genuinely diminishing returns.
The first renewed pressure point is the CLI edge because `dispatch/root.py`
still owned lifecycle and wiki request construction.

Evidence that forced the change:
Comparing the current Python rewrite against `../almanac` showed that Almanac's
CLI edge has a smaller root router and clearer product-noun dispatch modules.
`MANUAL.md` says the unit of work is evolving the codebase so the feature fits,
and Cosmic Python chapter 4 treats the service layer as the use-case boundary
rather than letting entrypoints become product logic.

Code or product assumption affected:
Slice 72 splits dispatch into lifecycle, wiki, and admin modules. The root
dispatcher is now only a domain delegator, which leaves background jobs,
setup/uninstall, structured page sources, and richer harness work with cleaner
CLI landing zones.

Follow-up test:
Run focused CLI/architecture tests after each CLI-domain change, and split
`cli/render/root.py` only when output behavior creates enough pressure to make
that split pay for itself.

## 2026-07-01 - Background Queue Membership Is Spec-Backed

Old hypothesis:
The next background-jobs step was simply to drain runs whose status was
`queued`.

New hypothesis:
A background queue item is a queued run with a durable executable spec. A
foreground lifecycle run also starts as `queued`, so worker eligibility must be
marked by `<run-id>.spec.json`, not status alone.

Evidence that forced the change:
`IngestWorkflow.run(...)` and `GardenWorkflow.run(...)` create a queued record
before `PageRunWorkflow.begin(...)` marks it running. A worker that selected
all queued records could steal or fail a foreground run during that legitimate
transition window.

Code or product assumption affected:
`RunStore.next_queued(...)` now selects only queued records with a spec file.
`RunQueueWorkflow` persists and consumes `RunSpec` values for Ingest/Garden,
and missing detached process spawning remains a separate slice.

Follow-up test:
When public foreground/background flags land, prove foreground lifecycle runs
still execute immediately and background lifecycle runs enqueue a spec-backed
record that a worker can drain.

## 2026-07-01 - Background Mode Without Default-Mode Drift

Old hypothesis:
Restoring the archive's background machinery might also mean restoring archived
operation defaults in the same slice.

New hypothesis:
Restore the machinery first and keep the default-mode decision explicit. Python
v1 can support `ingest --background` and `garden --background` without silently
changing the behavior of plain `ingest` and `garden`.

Evidence that forced the change:
The current Python CLI has shipped and tested foreground lifecycle semantics.
The archive defaulted some operations to background, but the live agreement
also says behavior reference should not silently simplify away lifecycle
semantics. Changing defaults is a product decision, not a prerequisite for the
process boundary.

Code or product assumption affected:
Slice 76 adds a worker-spawner port, subprocess adapter, hidden `__run-worker`
entrypoint, and explicit background flags. It leaves default foreground
behavior intact.

Follow-up test:
When deciding defaults, update README/manual/CLI tests together and dogfood the
chosen default from an installed CLI, not only through the app API.

## 2026-07-01 - Sync Can Enqueue Without Changing Automation Defaults

Old hypothesis:
Sync could stay purely foreground until the default background policy was
settled.

New hypothesis:
Manual sync needs explicit background mode because sync owns transcript
discovery, cursors, and pending ledger claims, but scheduled automation should
keep its current foreground behavior until unattended background policy is
decided.

Evidence that forced the change:
Background workers need durable Ingest specs, but sync also needs to remember
which transcript ranges have been claimed. The pending ledger claim must be
saved with the queued run id before a worker is spawned, otherwise a worker
failure or retry can leave transcript progress ambiguous.

Code or product assumption affected:
Slice 77 adds `SyncExecution` and `codealmanac sync --background`. Plain
`sync` and installed automation still run foreground.

Follow-up test:
If automation defaults change later, update the scheduler command contract,
README/manual text, and sync ledger tests in the same slice.

## 2026-07-01 - Page Sources Are Read-Model Provenance

Old hypothesis:
Structured page `sources:` could wait until a broader migration/source command
surface existed.

New hypothesis:
Structured page `sources:` are a core read-model contract and should land before
any migration command. The index can parse, project, display, and health-check
source provenance without adding source snapshots or source-query machinery.

Evidence that forced the change:
The live agreement and repo wiki both define `sources:` as the page evidence
model. The Python read model still derived file-aware search only from legacy
`files:` and wikilinks, so canonical `sources[type=file]` entries were invisible
to `search --mentions`, `show`, the viewer, and health.

Code or product assumption affected:
Slice 78 adds typed `PageSource` parsing, the `page_sources` SQLite projection,
file-ref derivation from file sources, source readback, and source-health
warnings. It does not add migration or source-catalog machinery.

Follow-up test:
When `migrate legacy-sources` is reopened, prove it rewrites frontmatter only
and preserves body bytes; do not fold that migration into health or Garden.

## 2026-07-01 - Setup Starts With Owned Instructions, Not Old Hosted Setup

Old hypothesis:
Restoring archived setup might mean porting the whole Node setup experience at
once, including auto-update scheduling, hosted/self-managed branches, and
legacy instruction cleanup.

New hypothesis:
Restore the setup-owned instruction contract first and keep the larger TUI,
automation-choice, provider-selection, and auto-update decisions for later
slices. The Python v1 command should use `codealmanac` markers and must not
remove old `almanac` artifacts that may belong to another install.

Evidence that forced the change:
The live agreement says setup/uninstall are required, but also says scheduled
update policy is not agreed and hosted setup wording is out of scope. The
archive shows Codex inline AGENTS blocks and Claude guide imports as the stable
instruction contract.

Code or product assumption affected:
Slice 79 adds `services/setup` plus `integrations/setup` and wires
`codealmanac setup` / `codealmanac uninstall` through the admin CLI edge. It
does not add raw-mode prompts, automation installation, provider model choice,
or auto-update scheduling.

Follow-up test:
The next setup slice should dogfood the terminal UX in a real TTY and decide
whether setup owns `automation install` choices directly or only presents
explicit next-step commands.

## 2026-07-01 - Setup Polish Belongs To The CLI Adapter

Old hypothesis:
Setup terminal polish might require expanding the setup service result model or
copying the archived ANSI helper machinery.

New hypothesis:
The setup service should stay fact-shaped, while the CLI render edge owns all
terminal presentation. Use Rich for panels and status layout instead of
hand-rolled ANSI helpers.

Evidence that forced the change:
Slice 79 already made setup/uninstall return typed results. The live agreement
requires terminal quality, and the user explicitly prefers common libraries
over hand-rolled implementations when mature libraries exist.

Code or product assumption affected:
Slice 80 adds `rich` as a runtime dependency and places all Rich imports in
`cli/render/setup.py`. Architecture tests now fail if Rich leaks outside the
CLI render edge.

Follow-up test:
The future raw-mode target selector should either use a terminal-input library
or explicitly document why Rich output plus argparse flags is enough for v1.

## 2026-07-01 - Serve Job Polling Belongs To The Read Edge

Old hypothesis:
The first `serve` jobs surface could stay static because browser run control was
out of scope and the CLI already had `jobs attach`.

New hypothesis:
The read-only jobs viewer should poll active runs because background jobs can
change durable run records after the browser has rendered them. Polling is a
read-side freshness behavior, not run-control machinery.

Evidence that forced the change:
Slice 89 restored `/api/jobs` and `/api/jobs/{run_id}` as read APIs, and slice
90 made the detail page useful enough to watch. A running background job detail
that never moves to `done` without manual refresh makes the local viewer feel
stale even though the run ledger is correct.

Code or product assumption affected:
Slice 91 keeps polling in `server/assets/viewer/jobs.js` and clears it from
`server/assets/viewer/main.js` on route/wiki changes. `ViewerService`,
`server/app.py`, and `RunsService` remain read-only from the viewer path.

Follow-up test:
If `serve` later adds richer live updates, start with this same read boundary:
replace the browser polling transport, but do not add browser-side cancel,
retry, or attach controls without a separate product decision.

## 2026-07-01 - Run IDs Are A Shared Product Type

Old hypothesis:
The viewer could protect `/api/jobs/{run_id}` with a local safe-character
validator while core run requests accepted plain strings.

New hypothesis:
Run-id safety belongs to the runs product model because run ids become filenames
under `<almanac-root>/jobs/` in every CLI, workflow, and viewer path.

Evidence that forced the change:
`ViewerJobRequest` rejected `../secret`, but `ShowRunRequest`,
`ReadRunLogRequest`, `AttachRunRequest`, and `CancelRunRequest` still accepted
plain strings before `RunStore` built paths such as `jobs/{run_id}.json`.
The live agreement says validation belongs at product boundaries and the user
explicitly preferred Pydantic validation over hand-rolled parsing.

Code or product assumption affected:
Slice 92 adds `RunId` as a Pydantic-constrained type in
`services/runs/models.py` and applies it to run records, run log events, run
requests, viewer job requests, and page-run workflow requests.
`services/runs/store.py` also validates path helper inputs through a Pydantic
`TypeAdapter(RunId)` before constructing filenames. The sync ledger still
stores `pending_run_id` as tolerant persisted recovery state; tightening that
would need its own migration/read-tolerance decision.

Follow-up test:
If future code adds a public request with an existing run id, import `RunId`
instead of adding a local `field_validator` or string character set.

## 2026-07-01 - GitHub Automation Is A Public Product Surface

Old hypothesis:
The Python release guide and README were enough to guard public packaging
language after slice 62 removed the npm release guide.

New hypothesis:
GitHub workflows and templates are public entrypoints too. They must run or ask
for the same uv/PyPI gates as local docs, and public-contract tests should
reject npm-era GitHub wording.

Evidence that forced the change:
`.github/workflows/ci.yml` still ran Node 20/22, `npm ci`, `npm run build`,
`npx tsc`, and `npm test`. `pack-check.yml` still ran `npm pack --dry-run`.
`publish.yml` still discussed `NPM_TOKEN`, and the templates still asked for
Node or npm details.

Code or product assumption affected:
Slice 93 rewrites GitHub CI/package-check/publish placeholders and GitHub
templates for the Python local product. The publish workflow stays disabled
until PyPI credentials, Trusted Publishing, and release provenance are
explicitly decided.

Follow-up test:
Any future `.github/` edit should keep `tests/test_public_contract.py` green
and should not introduce npm/Node/npx language outside archived reference docs.

## 2026-07-01 - GitHub Contract Tests Should Parse The Entry Point

Old hypothesis:
Text-fragment checks over `.github/` were enough to keep the GitHub surface
aligned with the Python product.

New hypothesis:
The workflow files should also be parsed as YAML so the contract test proves
the project entrypoint keeps a workflow-like shape before checking command
fragments.

Evidence that forced the change:
After slice 93, `uv sync --locked` passed locally, but the test only searched
raw text. The bug template also still had one stale "expected Almanac" sentence
that the broad stale npm guard missed.

Code or product assumption affected:
Slice 94 imports `ruamel-yaml` in `tests/test_public_contract.py`, parses each
workflow file, asserts `name`, `on`, and `jobs`, then checks the CI and package
workflow commands. The template now uses CodeAlmanac for product behavior while
still allowing "Almanac root" where it names the repo-local wiki root.

Follow-up test:
If a future change adds another workflow, update the parsed workflow list and
include the intended gate commands in the public-contract test.

## 2026-07-01 - Source Target Is A Parser Fallback, Not A Read-Model Branch

Old hypothesis:
Structured page sources could stay strictly type-specific because the manual
teaches `path:` for file sources and `url:` for web sources.

New hypothesis:
The parser should accept generic `target:` as a fallback for every page source
type, while keeping type-specific fields preferred. `PageSource.target` is
already the internal model and prompt-shaped lifecycle outputs can naturally use
`target:`.

Evidence that forced the change:
Slice 78 restored structured page sources, but `source_target()` ignored
generic `target:`. Existing fake lifecycle harnesses in the test suite write
`sources[type=file].target`, which meant the page kept a source id but did not
derive a file ref for `search --mentions`.

Code or product assumption affected:
Slice 99 keeps the alternate spelling inside
`services/wiki/frontmatter.py`. Downstream index, search, show, health, and
viewer code still consume normalized `PageSource.target` values and do not
branch on raw frontmatter spellings.

Follow-up test:
If a new source type is added, add its type-specific address fields to
`SOURCE_TARGET_FIELDS` and keep generic `target:` as the last fallback.

## 2026-07-01 - Codex App-Server Events Need The Same Boundary As Claude

Old hypothesis:
The Codex app-server event mapper could stay in one file because the transport
had only recently replaced `codex exec`, and tests covered the event payloads.

New hypothesis:
Codex app-server is the default lifecycle harness, so its provider-event edge
needs the same named boundaries as the Claude SDK edge. Dispatch, mutable run
state, actor attribution, item mapping, helper-agent traces, and final result
events have different reasons to change.

Evidence that forced the change:
After slice 99, the largest remaining production module was
`integrations/harnesses/codex/events.py` at 460 lines. Claude's mapper had
already been split and guarded in slice 85, while Codex still mixed state,
dispatch, base64 output decoding, tool display result construction, helper
agent lifecycle traces, usage messages, and done events.

Code or product assumption affected:
Slice 100 keeps `CodexAppServerClient` and the service-facing `HarnessAdapter`
contract unchanged. The split is entirely inside
`integrations/harnesses/codex/`, and the architecture guard now prevents the
Codex event dispatch module from regrowing item, actor, trace, usage, or output
decoding responsibilities.

Follow-up test:
If a future Codex app-server notification type adds a new event family, add a
named mapper module when the responsibility is not already owned by
`item_events.py`, `agent_events.py`, or `result.py`.

## 2026-07-01 - Codex App-Server Client Should Not Own Provider Policy

Old hypothesis:
After the event mapper split, `CodexAppServerClient` could keep server-request
responses, sandbox policy, timeout-env parsing, root-turn completion detection,
and result projection in `app_server.py` because those helpers were small.

New hypothesis:
`app_server.py` should own process startup, handshake requests, JSON-RPC reads,
and turn flow only. Provider policy helpers deserve named modules because they
change for different reasons than the transport loop.

Evidence that forced the change:
After slice 100, `app_server.py` was still the largest Codex module at 359
lines and still held `noninteractive_response`, `sandbox_policy`,
`root_turn_completion`, `result_from_state`, `failed_result`, and
`env_milliseconds`. The repo wiki's Codex app-server page and the archived
provider shape both distinguish response policy, sandbox construction, result
projection, and app-server process handling.

Code or product assumption affected:
Slice 101 keeps `CodexAppServerClient` and app-server behavior unchanged while
moving helpers into `responses.py`, `sandbox.py`, `turn_completion.py`,
`run_result.py`, and `timeouts.py`. Architecture tests now reject those helper
definitions inside `app_server.py`.

Follow-up test:
If Codex app-server later supports model/effort/output-schema request
construction, add a request-construction module instead of growing `_run()` with
more inline payload policy.

## 2026-07-01 - IndexStore Should Be A Facade, Not The Whole Indexer

Old hypothesis:
After the read-view split, `IndexStore` could keep schema DDL, migration setup,
markdown source loading, freshness signatures, and projection writes because
those mechanics all belong to the derived SQLite index.

New hypothesis:
`IndexStore` should stay the service-facing store facade, while schema,
source-loading, and projection writes live in named modules. Those three
mechanics all belong to the index service, but they change for different
reasons.

Evidence that forced the change:
After slice 101, `services/index/store.py` was still the largest production
module at 447 lines. The file mixed facade methods with `SCHEMA_DDL`, migration
construction, `load_page_document`, `load_topics_yaml`, source hashing,
signature persistence, and every `INSERT`/`DELETE` used to rebuild `index.db`.

Code or product assumption affected:
Slice 102 keeps query and refresh behavior unchanged. `schema.py` owns derived
`index.db` schema and connection setup, `sources.py` owns page/topic source
loading and freshness signatures, `projection.py` owns replacement writes and
stored signatures, and `store.py` delegates across those modules.

Follow-up test:
If future index work adds source filters, schema migrations, or projection
tables, extend the named module that owns the reason to change instead of
growing `store.py`.

## 2026-07-01 - Sync Policy Needs Rule-Family Modules

Old hypothesis:
After slice 95, one `workflows/sync/policy.py` module could own all
deterministic sync policy because `SyncWorkflow` had already been separated
from ledger and cursor mechanics.

New hypothesis:
`policy.py` should be a facade, not the whole sync-policy implementation.
Cursor decisions, ledger-entry transitions, identity matching, transcript
snapshots, summary rows, and generated prompt guidance each have separate
change triggers.

Evidence that forced the change:
After slice 102, `workflows/sync/policy.py` was the largest production module
at 417 lines. It mixed transcript file IO, SHA-256 cursor hashing, ledger-key
compatibility, pending/absorbed/failed transitions, retry-budget decisions,
pending-run reconciliation, skip/start result construction, and prompt guidance.

Code or product assumption affected:
Slice 103 keeps the public workflow and service imports unchanged.
`SyncWorkflow` still imports from `workflows/sync/policy.py`, while the facade
delegates to `decisions.py`, `entries.py`, `identity.py`, `snapshots.py`,
`reporting.py`, and `guidance.py`.

Follow-up test:
If a future sync feature adds new retry policy, source-app filtering, scheduler
ownership, or prompt guidance, extend the module that owns that rule family and
keep `service.py` orchestration-only.

## 2026-07-01 - GitHub Source Runtime Needs Adapter Internals Split

Old hypothesis:
`GitHubSourceRuntimeAdapter` could own GitHub PR and issue source runtime end to
end because it is one concrete `SourceRuntimeAdapter` implementation.

New hypothesis:
The public adapter should stay small, while GitHub CLI execution, typed payload
models, target argument policy, prompt-facing rendering, and unavailable
diagnostics live in focused modules under `integrations/sources/github/`.

Evidence that forced the change:
After slice 103, `integrations/sources/github/adapter.py` was the largest
production module at 413 lines. It mixed Pydantic `gh --json` payload models,
`gh` subprocess execution, PR/issue inspection flow, ref-to-target argument
policy, error shaping, and prompt rendering.

Code or product assumption affected:
Slice 104 keeps `GitHubSourceRuntimeAdapter` and all fake-runner behavior
unchanged. `client.py` owns `gh` execution and typed retrieval, `models.py` owns
payload models, `targets.py` owns target args, `rendering.py` owns source text,
and `errors.py` owns unavailable-runtime diagnostics.

Follow-up test:
If future GitHub source runtime adds reviews, linked issues, check runs, or a
native API/MCP transport, add the behavior to the module that owns the reason to
change instead of growing `adapter.py`.

## 2026-07-01 - Transcript Source Runtime Needs Entry And Rendering Boundaries

Old hypothesis:
`TranscriptSourceRuntimeAdapter` could own path resolution, JSONL reading,
Pydantic provider shapes, entry normalization, prompt rendering, and truncation
because it is one concrete `SourceRuntimeAdapter` implementation.

New hypothesis:
The public adapter should stay small, while transcript line models, file
reading, line-to-entry normalization, prompt-facing rendering, path resolution,
and unavailable diagnostics live in focused modules under
`integrations/sources/transcripts/`.

Evidence that forced the change:
After slice 104, `integrations/sources/transcripts/runtime.py` became the
largest production module at 387 lines. It mixed source-runtime orchestration
with provider JSON shape models, `jsonlines` parsing, tolerant Pydantic
validation, Codex/Claude entry normalization, text extraction, and tail
truncation.

Code or product assumption affected:
Slice 105 keeps `TranscriptSourceRuntimeAdapter` behavior unchanged. `models.py`
owns typed line and entry models, `reader.py` owns JSONL IO, `entries.py` owns
normalization, `rendering.py` owns prompt text and truncation, `paths.py` owns
path resolution, and `errors.py` owns unavailable-runtime diagnostics.

Follow-up test:
If future transcript runtime adds another provider shape, richer event
reconstruction, or alternate transcript storage, add it to the module that owns
that reason to change instead of growing `runtime.py`.

## 2026-07-01 - Source Address Resolution Should Not Live In The Service Facade

Old hypothesis:
`SourcesService` could own source address parsing because resolving selected
material is one of its product verbs.

New hypothesis:
`SourcesService` should own resolve/discover/inspect orchestration only.
Source-address syntax, prompt hints, URL validation, GitHub URL parsing, local
path classification, and file fingerprinting have their own reason to change
and belong in `services/sources/address_resolution.py`.

Evidence that forced the change:
After slice 105, `services/sources/service.py` was the largest production file
at 351 lines. It mixed injected adapter orchestration with GitHub shorthand
parsing, Git range/diff parsing, transcript address parsing, HTTP URL
validation, GitHub URL decomposition, local path classification, SHA-256 file
fingerprinting, and prompt-hint constants.

Code or product assumption affected:
Slice 106 keeps the public `SourcesService` API and source address grammar
unchanged. `address_resolution.py` owns the syntax mechanics and returns
`SourceBrief`; `transcripts.py` owns transcript candidate ordering; `service.py`
stays the facade over request models and ports.

Follow-up test:
If a future source kind adds syntax or classification rules, add it to
`address_resolution.py` or a source-family helper it delegates to. Do not grow
`SourcesService` unless the product verb itself changes.

## 2026-07-01 - CLI Render Root Should Be A Facade

Old hypothesis:
`cli/render/root.py` could own all ordinary text and JSON renderers because it
was already separate from parser and dispatch code.

New hypothesis:
`cli/render/root.py` should mirror `cli/parser/root.py` and
`cli/dispatch/root.py`: a stable facade over domain modules. Lifecycle output,
wiki read/mutation output, workspace registry output, admin output, Rich setup
presentation, and shared formatting each change for different reasons.

Evidence that forced the change:
After slice 106, `cli/render/root.py` was the largest production file at 338
lines. It mixed build/ingest/garden/sync output, run queue start output, local
wiki list/drop output, search/show/topics/health/tagging output, JSON dumping,
metadata formatting, and shared page-word/index helpers.

Code or product assumption affected:
Slice 107 keeps dispatcher imports stable by making `root.py` re-export the
same render function names. `lifecycle.py`, `wiki.py`, `workspaces.py`, and
`common.py` own the implementation details.

Follow-up test:
Future CLI output changes should land in the domain renderer that owns the
command family. Do not add rendering logic or service model imports to
`root.py`.

## 2026-07-01 - Filesystem Listing Needs Mechanic-Level Boundaries

Old hypothesis:
`integrations/sources/filesystem/listing.py` could own ignore specs, Python
walking, Git directory listing, Git status parsing, repo-root probing, and
directory document assembly because those all contribute to one filesystem
source runtime.

New hypothesis:
`listing.py` should assemble directory documents and choose Git-vs-walk source
policy, while ignore rules, Python walking, and Git mechanics each live in
their own modules. Those mechanics change for different reasons and already
have enough behavior to deserve names.

Evidence that forced the change:
After slice 107, `integrations/sources/filesystem/listing.py` became the
largest production module at 327 lines. It mixed `.gitignore` loading,
configured wiki-root ignores, recursive directory walking, Git `ls-files`,
Git `status --porcelain -z`, rename-source skipping, repo-root detection,
subprocess failure tolerance, and final document assembly.

Code or product assumption affected:
Slice 108 keeps filesystem runtime behavior unchanged. `ignore.py` owns ignore
spec construction, `walk.py` owns Python walking, `git.py` owns Git listing and
status mechanics, and `listing.py` remains the assembly facade.

Follow-up test:
Future filesystem material-selection changes should land in `selection.py` or
`listing.py` only when the assembly policy changes. Ignore, walking, and Git
mechanics should stay in their focused modules.

## 2026-07-01 - Sync Workflow Needs An Execution Effects Boundary

Old hypothesis:
`SyncWorkflow.run(...)` could own evaluated work-item execution because sync is
one workflow and policy had already been split out.

New hypothesis:
`SyncWorkflow` should own the public status/run/evaluate/scoping surface, while
`SyncRunExecutor` owns the side effects that turn evaluated work items into run
records, queue specs, ledger transitions, and started/needs-attention rows.

Evidence that forced the change:
After slice 108, `workflows/sync/service.py` was the largest production module
at 310 lines. The `run(...)` method mixed claim-owner selection with foreground
Ingest execution, background queueing, worker-spawn failure handling,
pending-entry writes, failed-entry writes, absorbed-entry writes, and summary
row construction.

Code or product assumption affected:
Slice 109 keeps foreground/background sync behavior unchanged. `service.py`
still exposes `status`, `run`, `evaluate`, and `scope_candidates`.
`execution.py` owns the execution effects and receives explicit workflow/service
dependencies through `SyncRunExecutor`.

Follow-up test:
Future sync execution changes such as default background mode, spawn retry, or
terminal-run reconciliation should land in `execution.py` unless they change
candidate selection or cursor policy.

## 2026-07-01 - Viewer Scope And Projection Are Separate From Use Cases

Old hypothesis:
`ViewerService` could own local workspace fallback, available-registry
filtering, multi-wiki navigation ordering, index-to-viewer DTO mapping, and the
viewer use cases because all of those details feed the `serve` payloads.

New hypothesis:
`ViewerService` should read as the local reader use-case facade.
`ViewerWorkspaceScope` should own selected-wiki fallback and registered-wiki
navigation. `projections.py` should own conversion from index/workspace models
to viewer DTOs.

Evidence that forced the change:
After slice 109, `services/viewer/service.py` was tied for the largest
production file at 303 lines. It mixed product verbs with registry filtering,
workspace fallback, topic summary construction, page source conversion, and
page summary projection.

Code or product assumption affected:
Slice 110 keeps `serve` behavior unchanged. Default `serve` still lists
available registered local wikis, `serve --wiki` still narrows scope, and the
browser still passes stable `workspace_id` selectors. The split only moves
selection and DTO mechanics behind named collaborators.

Follow-up test:
Future viewer payload changes should land in `service.py` only when they alter
the use case. Registry selection belongs in `workspace_scope.py`; browser DTO
conversion belongs in `projections.py`.

## 2026-07-01 - Web Runtime Needs Edge-Mechanic Boundaries

Old hypothesis:
`WebSourceRuntimeAdapter` could own HTTP streaming, response validation,
content-type classification, HTML text extraction, prompt rendering, and error
projection because all of those steps happen inside one web URL runtime.

New hypothesis:
The adapter should implement the `SourceRuntimeAdapter` port and coordinate the
web runtime path. `client.py` should own `httpx` response fetching,
`models.py` should own typed web payloads, `documents.py` should own content
classification and HTML/text parsing, `rendering.py` should own prompt-facing
text, and `errors.py` should own unavailable-runtime projection.

Evidence that forced the change:
After slice 110, `integrations/sources/web/adapter.py` was tied for the
largest production file at 303 lines. It mixed dependency wiring with
streaming HTTP reads, Pydantic response/document models, Beautiful Soup
cleanup, text normalization, metadata rendering, and diagnostic shaping.

Code or product assumption affected:
Slice 111 keeps web URLs as selected runtime material, not a source library or
crawler. The same `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime`
path feeds Ingest, and the adapter still accepts an injected `httpx.Client` for
testable dependency inversion.

Follow-up test:
Future web runtime changes should land in the module that owns the mechanism:
HTTP behavior in `client.py`, parsed document behavior in `documents.py`,
prompt text in `rendering.py`, and source-runtime port behavior in
`adapter.py`.

## 2026-07-01 - Workspace Service Should Not Own Every Workspace Mechanic

Old hypothesis:
`WorkspacesService` could own registration, resolution, selector matching,
path containment, workspace name/id generation, and marker-based registry
status because all of those mechanics support the workspace product surface.

New hypothesis:
`WorkspacesService` should be the workspace use-case facade. Workspace identity
belongs in `identity.py`, selector and containment mechanics belong in
`selection.py`, and marker-based registry availability belongs in `status.py`.
`store.py` should import identity directly instead of reaching back into the
service module.

Evidence that forced the change:
After slice 111, `services/workspaces/service.py` was the largest production
file at 303 lines. It mixed initialization-target logic, registration,
resolve/select/drop verbs, `sha256` id generation, kebab-case name generation,
ambiguous-name conflict handling, relative path selector expansion, path
containment checks, and `topics.yaml` + `pages/` availability status checks.

Code or product assumption affected:
Slice 112 keeps the configured-root and registry behavior unchanged. New repos
still default to `almanac/`, registered roots are preserved, unavailable
registry entries are not auto-dropped, and explicit `drop` / `drop_missing`
remain the only cleanup verbs.

Follow-up test:
Future workspace changes should land in the module that owns the mechanic:
identity in `identity.py`, selector/path rules in `selection.py`, marker/status
rules in `status.py`, root discovery in `roots.py`, and use-case orchestration
in `service.py`.

## 2026-07-01 - Harness Models Are A Contract Family, Not One Model File

Old hypothesis:
`services/harnesses/models.py` could own all normalized harness data because
provider adapters, workflows, runs, and the viewer all needed the same public
objects.

New hypothesis:
The service-owned harness contract should be split by product meaning, with
`models.py` kept only as a compatibility facade. Provider/status enums belong
in `kinds.py`, root/helper attribution belongs in `actors.py`, normalized
transcript event payloads belong in `events.py`, and readiness/transcript/result
objects plus terminal helper events belong in `results.py`.

Evidence that forced the change:
After slice 112, `services/harnesses/models.py` was the largest production file
at 302 lines. It mixed provider identity, run status, actor confidence, tool
display, usage accounting, failure metadata, agent trace payloads, event
records, run results, readiness, transcript refs, and terminal-message helpers.
The live agreement now treats normalized harness events as the inspectable
transcript surface, so this contract needs durable names and regression guards.

Code or product assumption affected:
Slice 113 keeps the old `services.harnesses.models` import path working for
callers, but the owning definitions now live in focused modules. Future provider
event fields should extend `events.py`; future result/readiness fields should
extend `results.py`.

Follow-up test:
Architecture tests should keep `models.py` facade-only and keep the focused
harness contract modules below their size bounds.

## 2026-07-01 - Doctor Checks Are Check Families, Not One Service Method

Old hypothesis:
`DiagnosticsService` could own install checks, wiki checks, manual checks,
index summaries, health summaries, workspace selection, registry checks, and
message formatting because all of those facts appear in one `doctor` report.

New hypothesis:
`DiagnosticsService` should stay the service-facing `doctor` facade. Install
readiness belongs in `diagnostics/install.py`, selected-wiki readiness belongs
in `diagnostics/wiki.py`, and shared doctor message formatting belongs in
`diagnostics/messages.py`.

Evidence that forced the change:
After slice 113, `services/diagnostics/service.py` was the third-largest
production module at 283 lines. It mixed package/runtime checks with workspace
selection, registry status, index rebuild handling, workspace manual drift,
wiki health, pluralization, and error-line formatting. The command is a public
readiness surface, so adding future doctor checks would have kept growing one
service file.

Code or product assumption affected:
Slice 114 keeps public `codealmanac doctor` output unchanged. The split only
changes ownership: install checks do not know wiki status, wiki checks do not
know package inventory, and the service remains the single public use-case
entrypoint.

Follow-up test:
Future doctor expansion should add a focused check-family module or extend the
existing family module, while architecture tests keep `service.py` facade-only.
