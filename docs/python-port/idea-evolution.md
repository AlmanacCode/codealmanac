# Python Port Idea Evolution

Updated: 2026-06-29

Record hypothesis changes here. Do not rewrite history; append a new entry when
evidence changes the shape.

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
`README.md`, `topics.yaml`, or `pages/`.

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
