# Python Port Ownership Map

Updated: 2026-07-01

This map turns `docs/python-port-live-agreement.md` into implementation
boundaries. If code needs a different boundary, update this file and record the
reason in `idea-evolution.md`.

## Dependency Direction

```text
cli/server
  -> app
    -> workflows
      -> services
        -> stores
        -> ports
          -> integrations
```

`src/codealmanac/app.py` is the composition root. CLI commands, automation
entrypoints, tests, and future server wrappers get an application object from
that root instead of constructing stores or adapters themselves.

## Services

| Service | Owns | First implementation pressure |
|---|---|---|
| `workspaces` | repo root detection, configurable Almanac root, registry, nearest-root discovery, path containment, local wiki selection, explicit registry cleanup | `init`, `list`, current-repo queries, `--wiki` lookup |
| `wiki` | page files, frontmatter, topics, wikilinks, page writes, health inputs | `init`, `show`, page parsing for index |
| `index` | SQLite derived read model, projection refresh/write facade, read-only query views, FTS, mentions, backlinks, health projections | `search`, `show --links`, `health` |
| `topics` | topic use cases, topic DAG validation, topic workspace selection | `topics`, `topics show`, `topics create/describe/link/unlink/rename/delete` |
| `sources` | source observations, source refs, address resolution, fingerprints, local source state, source runtime snapshots, transcript discovery ports and typed transcript candidates | `SourceAddress`/`SourceRef`/`SourceBrief`/`SourceRuntime`, `SourceRuntimeAdapter`, `TranscriptDiscoveryAdapter`, `TranscriptCandidate`, ingest and sync inputs |
| `runs` | run ledger, events, outputs, lifecycle state transitions, persisted harness transcript identity | `jobs` read surface, lifecycle workflows, future sync exclusion and reconciliation |
| `harnesses` | normalized Codex/Claude run contracts, provider transcript refs, provider-neutral harness events, and ports | `HarnessKind`/`RunHarnessRequest`/`HarnessRunResult`/`HarnessTranscriptRef`/`HarnessEvent`/`HarnessAdapter`, later `build`, `ingest`, `garden` |
| `automation` | local scheduler decisions, quiet windows, unattended sync command policy, installed task state | `AutomationTask`/`ScheduledJob`/`SchedulerAdapter`, `sync` and `garden` scheduling |
| `config` | user/project TOML parsing and precedence for local CLI defaults | lifecycle harness default and sync quiet window |
| `diagnostics` | doctor checks and readiness reports | `doctor`, local install/wiki readiness |
| `updates` | package update planning, installer metadata, supported foreground update methods | `codealmanac update`, `PackageInstallMetadataProvider`, `PackageCommandRunner` |
| `setup` | setup/uninstall command requests, setup-owned agent instruction result models, and the instruction installer port | `codealmanac setup`, `codealmanac uninstall` |
| `viewer` | read-only browser payloads, page/topic/search/file overview assembly, multi-wiki local viewer scope, rendered markdown for the local viewer | `serve`, future non-CLI read adapter |

## Support Packages

| Package | Owns | First implementation pressure |
|---|---|---|
| `database` | SQLite connection setup, PRAGMA policy, and migration application helpers | `index.db` read model |
| `prompts` | packaged lifecycle prompt doctrine and operation prompt rendering | `ingest`, `garden`, future `sync` |
| `manual` | packaged wiki-maintenance rulebook and workspace manual materialization helpers | `build`, `doctor`, lifecycle prompt guidance |

## Workflows

| Workflow | Owns | Calls |
|---|---|---|
| `build` | initial wiki creation or refresh | `workspaces`, `wiki`, `index` |
| `ingest` | update wiki from selected local material | `sources`, `runs`, `harnesses`, `index`, `prompts`, `lifecycle` |
| `sync` | discover quiet local transcripts, scope them to local wikis, coordinate run-record lookup and ledger persistence, call sync policy for cursor/ledger decisions, run foreground ingest or enqueue background ingest, and assemble sync summaries | `sources`, `runs`, `ingest`, `run_queue`, sync ledger store, sync policy, automation command policy |
| `garden` | maintain wiki shape, links, topics, staleness, quality | `health`, `index`, `runs`, `harnesses`, `prompts`, `lifecycle` |

Workflows coordinate. They do not own durable schema unless a missing service is
identified and added to this map.

`services/wiki/frontmatter.py` is the normalization boundary for page
frontmatter. It accepts type-specific source address fields first and generic
`target:` as a fallback, then returns normalized `PageSource.target` values.
Index, search, show, health, and viewer code must consume `PageSource` rather
than reading raw source frontmatter keys.

`workflows/lifecycle.py` owns shared lifecycle execution helpers: harness-result
validation and Git-backed wiki-root mutation safety. Operation-specific
workflows pass their public verb into `LifecycleMutationPolicy`, so shared
safety does not leak another workflow's product language.

## Integration Rule

Concrete adapters live under `integrations/` by the service port they implement:

```text
integrations/
  harnesses/
    codex/
    claude/
  sources/
    filesystem/
    git/
    github/
    transcripts/
    web/
  automation/
    scheduler/
  setup/
  updates/
```

An integration translates outside-world behavior into service-owned models and
errors. It does not decide product policy.

`src/codealmanac/app.py` is the only production module that wires concrete
integrations. Tests enforce that `cli/`, `workflows/`, and `services/` do not
import `codealmanac.integrations`.

`services/workspaces/ports.py` also owns `WorkspaceChangeProbe`, the port used
by lifecycle workflows to inspect repo/worktree mutation state. The concrete
Git implementation lives in `integrations/workspaces/git/`. Ingest policy
decides what mutations are allowed; the Git integration only reports observed
state.

`integrations/command.py` holds captured subprocess execution shared by local
integration adapters. It is not a service port because it describes local
process mechanics, not a product contract.

`database/` holds local SQLite mechanics shared by stores. `connect_sqlite`
creates parent directories, applies row factory and PRAGMA policy, sets a
busy timeout before WAL mode, and returns the connection. `apply_migrations`
applies typed `SQLiteMigration` values in version order. Product stores still
own SQL schema text and write/query semantics.

`services/index/store.py` is the service-facing `IndexStore` facade.
`services/index/schema.py` owns derived `index.db` schema, migrations, and the
index connection helper. `services/index/sources.py` owns page/topic source
loading and freshness signatures. `services/index/projection.py` owns
replacement writes and stored source signatures. `services/index/views.py` is a
small read facade. `services/index/search_views.py` owns FTS and file-mention
query construction, `summary_views.py` owns count summaries, `page_views.py`
owns page detail projections, `topic_views.py` owns topic DAG reads, and
`health_views.py` owns health findings.

`services/config/` owns local config parsing and precedence. `ConfigStore`
uses `pydantic-settings` TOML sources to build the frozen
`CodeAlmanacConfig` settings model. `ConfigService` supplies sources in
precedence order: selected project `<almanac-root>/config.toml`, then user
config, then model defaults. CLI flags remain the final override at the
command edge. There is no public `config` command in v1.

`services/diagnostics/service.py` is the `doctor` facade. `install.py` owns
install/runtime/manual-package readiness checks, `wiki.py` owns selected-wiki
registry/index/manual/health readiness checks, and `messages.py` owns shared
doctor message formatting.

`services/topics/service.py` is the use-case facade for topic commands.
`services/topics/graph.py` owns topic existence checks, self-parent validation,
and cycle traversal over `TopicDefinition` values.
`services/topics/read_model.py` owns topic slug lookup through the derived
index. `services/topics/workspace.py` owns current-repo vs explicit-`--wiki`
selection through `WorkspacesService`.

`services/workspaces/roots.py` owns repo-local Almanac root validation and
nearest-root discovery. `DEFAULT_ALMANAC_ROOT` is `almanac/`. The registry
stores each workspace's repo-relative `almanac_root`; downstream services use
`workspace.almanac_path` instead of concatenating a literal path.
`services/workspaces/service.py` is the use-case facade. `identity.py` owns
workspace name/id generation, `selection.py` owns selector matching and path
containment, `status.py` owns marker-based registry availability, and
`store.py` owns registry JSON persistence.

`integrations/harnesses/git_status.py` holds Git porcelain changed-file
snapshots shared by Claude and Codex harness adapters.

Harness adapters translate provider output into `HarnessEvent` values before
workflows persist anything to run logs. Raw provider transcript files are not a
workflow contract; they are optional provider evidence for exclusion and
debugging.
`services/harnesses/models.py` is a facade for the service-owned harness
contracts. `kinds.py` owns provider/status enums, `actors.py` owns root/helper
attribution models, `events.py` owns normalized event payloads, and
`results.py` owns readiness, transcript references, run results, and terminal
event helpers.
Codex app-server event normalization is split by provider-edge reason to
change: `events.py` dispatches notifications, `state.py` stores mutable run
state, `actors.py` assigns root/helper attribution, `item_events.py` maps tool
items and output deltas, `agent_events.py` maps helper-agent lifecycle traces,
and `result.py` maps usage, provider-session, turn completion, and final done
events.
Codex app-server transport stays separate from provider policy helpers:
`app_server.py` owns process startup, handshake requests, JSON-RPC reads, and
turn flow; `responses.py` owns noninteractive server-request responses;
`sandbox.py` owns sandbox mode/env policy and turn sandbox payloads;
`turn_completion.py` owns root-turn completion detection; `run_result.py` owns
`HarnessRunResult` projection; and `timeouts.py` owns tolerant timeout-env
parsing.

`services/runs/store.py` is the service-facing repository facade for the run
ledger. `services/runs/paths.py` owns run-id validation and file naming,
`services/runs/io.py` owns JSON record/spec and JSONL event file mechanics,
`services/runs/locks.py` owns worker lock ownership, and
`services/runs/transitions.py` owns grouped record-plus-event transition writes.
Callers should not hand-pair record rewrites with status event appends outside
the transition writer.

`services/sources/ports.py` owns `TranscriptDiscoveryAdapter`, the port used by
sync to observe local transcript stores. Concrete Codex and Claude JSONL
scanners live in `integrations/sources/transcripts/`. Those integrations parse
raw provider JSON and return typed `TranscriptCandidate` values; they do not
decide quiet windows, cursor state, or whether ingest should run.
`TranscriptCandidate` carries both `repo_root` and `almanac_path` so sync can
write ledgers under the configured root without guessing.

`workflows/sync/service.py` owns sync selection orchestration. It discovers
transcripts, scopes them to the requested local wiki, loads run records and
ledgers, evaluates policy decisions, and assembles status/sync summaries.
`workflows/sync/execution.py` owns sync run execution effects: foreground
Ingest execution, background queueing, worker-spawn failure handling,
pending/failed/absorbed ledger writes, and started summary rows.

`workflows/sync/policy.py` is the deterministic sync-policy facade imported by
`SyncWorkflow`. `decisions.py` owns cursor decisions and pending-run
reconciliation. `entries.py` owns pending/absorbed/failed ledger-entry
transitions. `identity.py` owns workspace, session, run-record, and ledger-key
identity helpers. `snapshots.py` owns transcript snapshot reading, line counts,
and cursor-prefix hashes. `reporting.py` owns skipped/started summary rows.
`guidance.py` owns generated cursor guidance for Ingest. Scheduled sync uses
the same workflow/policy split.

The same source service owns `SourceRuntimeAdapter`, the port used by Ingest to
turn selected source refs into bounded readable material before harness
execution. `services/sources/address_resolution.py` owns source-address syntax,
and dispatches to source-family modules. `address_git.py` owns Git range/diff
syntax, `address_github.py` owns GitHub shorthand and URL decomposition,
`address_web.py` owns HTTP URL validation and generic web refs,
`address_path.py` owns local path classification and file fingerprints,
`address_transcript.py` owns transcript refs, `address_hints.py` owns prompt
hints, and `address_numbers.py` owns shared positive-integer parsing.
`SourcesService` calls it from the `resolve` verb but does not own those
parsing rules. `integrations/sources/filesystem/` reads
explicit local files and bounded directory material. `adapter.py` implements the
service-owned
`SourceRuntimeAdapter` port and delegates to module-level responsibilities:
`documents.py` owns text document models, file byte bounds, and
`charset-normalizer` decoding; `listing.py` owns directory document assembly
and Git-vs-walk source selection; `ignore.py` owns default/configured ignore
rules and `.gitignore` loading; `walk.py` owns Python directory walking;
`git.py` owns Git listing, Git status parsing, repo-root probing, and Git
command tolerance; `selection.py` owns semantic diversity for clean directory
selection; `rendering.py` owns prompt-facing runtime text; `paths.py` owns
shared display/relative path helpers. The adapter normalizes the request `cwd`
before delegating because source refs are already normalized; this keeps
symlinked and macOS alias paths rendered relative to the selected workspace.
`InspectSourceRuntimeRequest.context.ignored_directories` carries workflow-owned
runtime policy such as the resolved `workspace.almanac_root`; filesystem
adapters apply those ignores but do not hard-code Almanac root names.
`integrations/sources/git/` uses Git CLI commands for local
`git:diff` and `git:range` refs. `integrations/sources/github/` uses GitHub CLI
for PR and issue refs. `adapter.py` implements the service-owned
`SourceRuntimeAdapter` port, `client.py` owns `gh` command execution and typed
payload retrieval, `models.py` owns Pydantic `gh --json` payloads, `targets.py`
owns `SourceRef` to `gh` target argument policy, `rendering.py` owns
prompt-facing PR and issue runtime text, and `errors.py` owns unavailable
runtime diagnostics. `integrations/sources/transcripts/` reads provider JSONL
transcripts with `jsonlines`, validates known Codex and Claude shapes with
Pydantic, and renders bounded transcript snapshots. `runtime.py` implements the
service-owned `SourceRuntimeAdapter` port, `models.py` owns typed transcript
line and entry models, `reader.py` owns JSONL file reading, `entries.py` owns
line-to-entry normalization, `rendering.py` owns prompt-facing text and
truncation, `paths.py` owns path resolution, and `errors.py` owns unavailable
diagnostics. Ingest does not branch on source kind. `integrations/sources/web/`
uses `httpx` plus Beautiful Soup to fetch generic web URLs, remove non-readable
HTML nodes, and render bounded HTML/text snapshots through the same
source-runtime port. `adapter.py` implements the port, `client.py` owns
streaming HTTP reads, `models.py` owns typed web response/document models,
`documents.py` owns content-kind classification and HTML/text extraction,
`rendering.py` owns prompt-facing metadata/content rendering, and `errors.py`
owns unavailable diagnostics.

`services/automation/ports.py` owns `SchedulerAdapter`, the port used by local
automation install/status/uninstall. `services/automation/service.py` is the
install/status/uninstall facade. `selection.py` owns task defaulting and
install-selection validation. `definitions.py` owns static task metadata.
`jobs.py` owns `ScheduledJob` construction, including sync's stable claim owner,
pending timeout, failed-attempt budget, launch PATH, plist path, interval, and
working directory. The launchd implementation lives in
`integrations/automation/scheduler/` and only translates `ScheduledJob` models
into plist files plus launchctl calls. It does not decide which jobs should
exist or what `sync` and `garden` mean.

`services/updates/ports.py` owns package install metadata and package command
execution ports. `integrations/updates/` reads `importlib.metadata` install
metadata and runs foreground package-manager commands. The service decides
whether an install is safe to update; the integration only reports metadata and
executes the chosen command.

`services/setup/ports.py` owns `InstructionInstaller`, the port used by setup
and uninstall for global agent instruction artifacts. `integrations/setup/`
translates that port into filesystem edits for Codex and Claude: a managed
`codealmanac` AGENTS block for Codex, and a `~/.claude/codealmanac.md` guide
plus `CLAUDE.md` import for Claude. The adapter removes only current
setup-owned `codealmanac` artifacts; old `almanac` artifacts are outside
Python v1 compatibility scope.

`services/viewer` owns the local browser payload for file references. Its
`file` verb delegates to the index's mentions query and returns matching wiki
pages. It must not read repo source contents directly or reuse source runtime
adapters; selected source material belongs to lifecycle workflows, while viewer
file routes are graph-navigation routes. `services/viewer/renderer.py` owns
Markdown rendering and token-level wikilink rewriting for the local viewer; it
rewrites text inline tokens and leaves code tokens untouched.
`services/viewer` also owns local wiki scope for the viewer. Overview responses
return the selected workspace plus available registered local workspaces, using
`workspace_id` as the stable selector. The service skips unavailable registry
entries without dropping them. The server and browser pass optional wiki
selectors; they do not decide registry availability or workspace fallback.
`services/viewer/workspace_scope.py` owns that selection and navigation
ordering. `services/viewer/projections.py` owns viewer DTO conversion from
index/workspace models. `services/viewer/service.py` should read as the
use-case facade that calls the index, runs service, renderer, scope, and
projection helpers.

`server/assets/` owns the packaged browser shell for `serve`. It can borrow
UseAlmanac's visual language, but it must preserve `services/viewer` as the
product contract and keep local wiki navigation first: sidebar, overview,
page, topic, search, file-reference graph routes, and read-only page viewing.
Hosted UseAlmanac account, billing, settings, and hosted wiki-search flows do
not belong in this local viewer.

`server/app.py` is the local viewer server composition root. It creates the
FastAPI app and registers error handlers, viewer API routes, and static routes.
`server/api_routes.py` owns HTTP request construction for `services/viewer`.
`server/static_routes.py` owns browser-shell route registration.
`server/static_assets.py` owns package asset validation and reads.
`server/errors.py` owns CodeAlmanac/Pydantic exception mapping to HTTP JSON.
No route body, package-resource read, or product-error mapping belongs back in
`server/app.py`.

`cli/render/root.py` is a re-export facade over domain render modules so
dispatch imports stay stable. `cli/render/lifecycle.py` owns
build/ingest/garden/sync/job-start output, `wiki.py` owns
search/show/topics/health/tagging output, `workspaces.py` owns local wiki
registry list/drop output, `admin.py` owns setup/doctor/update/jobs/automation
output, and `common.py` owns shared formatting helpers. `cli/render/setup.py`
owns Rich-backed setup/uninstall terminal presentation. Render modules display
service-returned facts only. Rich must not be imported from services,
workflows, integrations, or stores.

The browser shell stays static package data while it is small. `app.js` is the
module entrypoint. `server/assets/viewer/api.js` owns HTTP calls, `routes.js`
owns hash parsing and href construction, `components.js` owns shared DOM
pieces, `renderers.js` owns screen assembly, and `main.js` wires browser events
and the selected wiki switcher to those modules. Sidebar page/topic active
state is browser route state over the existing hash routes, not a second server
contract. The server owns validation and delivery of nested package assets
through `/assets/{path}`.

`manual/` is a support package rather than a product service. `ManualLibrary`
loads bundled Markdown resources, installs missing files into
`<almanac-root>/manual/`, and reports workspace manual completeness plus exact
differences from bundled docs. `app.py` constructs it once and injects it into
`WikiService` and `DiagnosticsService`. There is no public `manual` command in
v1. Manual drift is diagnostic: `doctor` can ask the user to review changed
files, but build/init do not overwrite local manual edits.

`services/wiki/topic_models.py` owns the parsed `topics.yaml` topic model and
title defaults. `topic_read.py` owns the forgiving read path used by index
refresh: invalid or missing topic files collapse to an empty topic set.
`topic_file.py` owns the strict round-trip mutation path used by topic
organization commands: it preserves comments, quotes, and line endings while
writing through a temporary file. `services/wiki/topics.py` is only an import
facade for existing callers.

## First Slice Boundary

The first Python implementation slice should prove:

- package install metadata exists
- `codealmanac` invokes a Python CLI
- `app.py` wires a minimal application object
- `workspaces` can resolve and initialize a local configurable Almanac root
- tests run through public service/CLI entrypoints, not hidden helpers

This is intentionally smaller than the full product surface. It should create
the spine that future slices extend without rework.
