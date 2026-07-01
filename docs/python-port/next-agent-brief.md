# Next Agent Brief

Updated: 2026-07-01

## Current State

- The earlier Python local-product implementation goal reached public-beta
  package proof in slice 71, but the active goal now reopens architecture
  quality work before release: keep applying Cosmic Python, `MANUAL.md`, and
  useful `../almanac` patterns until further cleanup is genuinely diminishing
  returns.
- Branch: `dev`.
- Latest implementation slice: slice 113 harness contract boundaries.
- Live contract: `docs/python-port-live-agreement.md`.
- Public release gate: `docs/python-port/public-release-readiness.md`.
- Public beta audit: `docs/python-port/public-beta-gate-audit.md`.
- Cosmic Python local guide: `docs/reference/cosmic-python/CODEALMANAC.md`.
- Latest verified source-runtime direction: selected local material becomes
  `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime` before Ingest
  calls a harness.
- Current Python product surface includes CLI/app composition, workspace
  registry, configurable Almanac root, SQLite read model, search/show/topics/health,
  tag/untag/topic mutation, reindex, doctor, serve, runs/jobs, ingest, garden,
  foreground sync, sync status, local automation, Codex app-server and Claude
  SDK harness adapters, transcript discovery, source runtime adapters, bundled
  manual resources materialized into `<almanac-root>/manual/`, and a
  conservative package update command.
- There is no public or hidden cloud capture surface. `codealmanac update`
  updates the installed CLI package only. `sync` scans local transcripts and
  runs local ingest. `automation` schedules local `sync`/`garden`.
  `capture`, cloud upload, hosted connection, and login remain outside Python
  v1.
- `codealmanac update` is dogfooded from non-editable pip and uv-tool installs.
  Successful package-manager execution reports status `completed`, not
  `updated`, because package-manager output may say no files changed and the
  service does not scrape prose for stronger semantics.
- Slice 41 implements the configured-root decision: new repos default to
  `almanac/`; `docs/almanac/` is the public alternate repo shape. The registry
  stores `almanac_root`, `Workspace` exposes `almanac_path`, project config
  lives under `<almanac-root>/config.toml`, run logs and sync ledgers live under
  `<almanac-root>/jobs/`, and prompts/manual text refers to the configured
  Almanac root.
- Slice 70 moves default user/global state to `~/.codealmanac/`. The repo-local
  wiki root remains `almanac/`; registry, user config, and automation logs now
  use the product-specific hidden directory.
- Slice 71 reran current-head package proof after the slice 70 state-path and
  README changes. Fresh wheel and sdist artifacts passed `twine check`,
  metadata/package-data inspection, clean Python 3.12.9 installs, installed CLI
  smoke, live `serve` HTTP checks, and explicit `~/.codealmanac/registry.json`
  state-path assertions.
- Slice 42 completes the configured-root source-runtime follow-through:
  Ingest passes `workspace.almanac_root` through `SourceRuntimeContext`, and
  filesystem directory runtime applies that context for both Git listing and
  Python/pathspec walking. The adapter no longer hard-codes Almanac root names.
- The local viewer now exposes `/api/file?path=...` and frontend
  `#/file/<path>` for wiki file/folder reference navigation. It lists pages
  mentioning the reference and does not read repo source contents.
- Viewer Markdown rendering uses `markdown-it-py` token streams. Wikilink
  rewriting touches inline text tokens only; inline code and fenced code remain
  source text, and link labels are escaped by the renderer.
- `serve` now borrows UseAlmanac's alpine dashboard visual language but keeps
  CodeAlmanac's local wiki IA. Preserve the sidebar/page graph/search/topic/file
  navigation model; do not copy UseAlmanac's hosted wiki page-list/search flow,
  hosted account routes, billing/settings surfaces, or hosted wording. The
  current UseAlmanac wiki page/search UX is a non-target reference. The desired
  shape is the earlier CodeAlmanac sidebar-first local viewer with better visual
  treatment layered over it.
- Slice 51 is a narrow `serve` shell polish pass:
  repo-owned wiki rail wording, `Local knowledge graph` scope text, active
  page/topic rail links from hash-route metadata, mobile rail density cleanup,
  and a CSS guard against viewport-scaled type. Browser-harness visual dogfood
  passed through an isolated temporary Chrome profile with explicit `BU_CDP_URL`;
  default-profile Chrome still requires the manual remote-debugging Allow click.
- Bulletproof React Markdown reference lives under
  `docs/reference/bulletproof-react/`. Treat it as frontend architecture
  guidance for future viewer growth, not a reason to add React/Next.js while
  the static package-data viewer remains maintainable.
- The served frontend now uses static ES modules. `app.js` imports
  `/assets/viewer/main.js`; nested modules split API calls, routes, shared DOM
  components, and screen renderers. The server validates nested static asset
  paths before serving them.
- Structured page `sources:` are now part of the SQLite read model. The indexer
  parses supported page provenance types, projects `page_sources`, derives
  file refs from `sources[type=file]`, exposes sources through `show --meta`,
  `show --json`, and viewer page APIs, and reports missing citations, unused
  sources, and duplicate source ids through health. This is page evidence,
  not the source-runtime input model.
- Slice 99 makes page source target parsing tolerant at the frontmatter
  boundary: type-specific fields such as `path:` and `url:` remain preferred,
  and generic `target:` is a fallback that normalizes into
  `PageSource.target`. Index, search, show, health, and viewer code should keep
  consuming normalized page sources rather than raw frontmatter keys.
- Slice 79 restores the first setup/uninstall layer. `SetupService` owns
  setup/uninstall requests and results; `integrations/setup` installs/removes
  Codex and Claude instruction artifacts behind `InstructionInstaller`.
  `codealmanac setup --yes --target codex|claude|all` installs a current
  `codealmanac` managed instruction block or Claude guide/import. `codealmanac
  uninstall --yes --target ...` removes only those setup-owned artifacts.
  Later slices restored Rich terminal output, default harness recommendations,
  and explicit setup-owned automation. Raw-mode target selection remains a
  possible polish slice if setup interaction is reopened.
- Slice 80 improves setup/uninstall terminal output through Rich under the CLI
  render edge. Services still return Pydantic result facts; only
  `cli/render/setup.py` imports Rich. Text setup output now has a branded panel,
  status rows, and an explicit next-steps box that suggests manual automation
  separately from setup. JSON output remains unchanged.
- Slice 81 restores multi-wiki local viewer scope. `ViewerOverview` returns the
  selected workspace plus available registered local workspaces, detail/search
  viewer routes accept a `wiki` query selector, the static sidebar switcher uses
  stable `workspace_id` values, unavailable registry entries are skipped without
  being dropped, and `serve --wiki` narrows the viewer to one workspace.
- Slice 82 upgrades the Python harness event contract from display-only events
  to structured normalized event payloads. `HarnessEvent` can now carry tool
  display details, actor/root/helper attribution, usage counts, provider session
  ids, failure metadata, agent trace records, and raw JSON debug payloads.
  `RunLogEvent` stores the readable `kind`/`message` plus optional nested
  `harness_event` JSON, so text `jobs logs` remains stable while JSON logs can
  serve as the inspectable transcript surface.
- Slice 113 splits the service-owned harness contract by meaning without
  changing behavior. `services/harnesses/models.py` is now only a small
  import-compatible facade; `kinds.py` owns provider/status enums, `actors.py`
  owns root/helper attribution, `events.py` owns normalized event payloads, and
  `results.py` owns readiness, transcript refs, run results, and terminal
  helper events. Architecture tests keep the facade small and the contract
  modules bounded.
- Slice 83 makes the default Codex lifecycle harness use
  `codex app-server --listen stdio://` instead of `codex exec`. The adapter
  isolates MCP config with `mcp_servers={}`, creates ephemeral threads, declines
  approval/user-input/token-refresh requests noninteractively, runs
  workspace-write with network disabled, maps app-server notifications into
  normalized harness events, preserves root/helper turn attribution, and keeps
  changed-file accounting around the run.
- Slice 100 splits Codex app-server event normalization by provider-edge
  responsibility. `events.py` dispatches notifications; `state.py` owns mutable
  run state; `actors.py` owns root/helper attribution; `item_events.py` owns
  item/output mapping; `agent_events.py` owns helper traces; and `result.py`
  owns usage, provider-session, turn-completion, and done events. Architecture
  tests now prevent the dispatch module from regrowing the old event monolith.
- Slice 101 keeps `CodexAppServerClient` focused on process startup, handshake
  requests, JSON-RPC reads, and turn flow. Noninteractive server-request
  responses, sandbox mode/payload policy, root-turn completion detection,
  timeout env parsing, and `HarnessRunResult` projection now live in focused
  Codex provider modules, with an architecture guard preventing those helpers
  from returning to `app_server.py`.
- Slice 84 makes the default Claude lifecycle harness use `claude-agent-sdk`
  instead of `claude -p --output-format json`. The SDK client isolates ambient
  Claude settings with `setting_sources=[]`, `strict_mcp_config=True`, and
  `mcp_servers={}`, runs with `permission_mode="dontAsk"`, maps typed SDK
  dataclasses into normalized provider-session/text/tool/usage/helper/error/done
  events, and keeps changed-file accounting in the adapter. The slice uses fake
  SDK streams for verification; no paid real-Claude model dogfood was run.
- Slice 85 splits the Claude SDK event mapper by provider-edge responsibility.
  `events.py` is now a 77-line dispatcher/re-export surface, while SDK union
  typing, mutable run state, actor attribution, raw JSON conversion, final
  result handling, assistant/user/result message mapping, stream deltas, tool
  block mapping, and task lifecycle messages live in separate modules. An
  architecture test keeps Claude harness modules below 220 lines and prevents
  `events.py` from regrowing block mapping or raw conversion logic.
- Slice 85 review removed the remaining `events.py` facade imports from
  `ClaudeSdkClient`. The client now imports state, SDK-message helpers, and
  result helpers from their owning modules; `events.py` only dispatches SDK
  messages.
- Slice 86 aligns config defaults with the live agreement: no-flag lifecycle
  runs default to Codex. Setup now returns a typed `SetupPlan` containing the
  default harness, selected instruction targets, sync/garden automation
  recommendations, and shared next-step commands. Setup still recommends
  automation explicitly; it does not install automation or add interactive
  target selection.
- Slice 87 restores explicit setup-owned local automation installation.
  `codealmanac setup --install-automation` and sync/Garden timing flags now
  install scheduled automation through the Python `AutomationService` port, not
  through CLI shell-out. Plain setup still only recommends automation.
  `codealmanac uninstall` removes scheduled automation by default, and
  `--keep-automation` preserves scheduler entries.
- Slice 88 updates user-facing docs after setup gained automation install
  flags. README now documents explicit setup automation commands and
  `--keep-automation`; `docs/concepts.md` includes setup/uninstall in Admin;
  public-contract tests guard against the old "does not install scheduled
  automation" wording returning.
- Slice 89 restores a read-only jobs surface in `serve`. `ViewerService` now
  exposes jobs list/detail DTOs over `RunsService`, FastAPI serves `/api/jobs`
  and `/api/jobs/{run_id}`, and the static viewer renders `#/jobs` plus
  `#/jobs/<run-id>` with normalized harness event details. Browser write
  controls remain out of scope; CLI `jobs attach` and `jobs cancel` still own
  run control.
- Slice 90 makes the job detail page render more of the normalized
  `HarnessEvent` payload: tool display rows, usage token rows, failure
  details, and agent trace rows. It still does not read raw provider transcript
  files or expose browser-side run controls.
- Slice 91 makes the read-only jobs views poll the existing jobs API while
  queued or running jobs are visible. `server/assets/viewer/jobs.js` owns the
  browser timer and route guard; `viewer/main.js` clears polling on route and
  wiki changes. No server endpoint, viewer service, or run-control mutation
  surface was added.
- Slice 92 moves run-id validation into the runs product model. `RunId` is a
  Pydantic-constrained type in `services/runs/models.py`, used by run records,
  run log events, run request models, viewer job requests, and page-run
  workflow requests. `RunStore` also validates path helper inputs with
  `TypeAdapter(RunId)`. Path-shaped or dotted public job ids now fail request
  validation before `RunStore` constructs `<almanac-root>/jobs/{run_id}.*`
  paths, and direct store calls cannot use unsafe ids.
- Slice 93 removes the remaining Node/npm GitHub automation and template
  surface. `.github/workflows/ci.yml` now runs the Python uv gates, package
  check builds wheel/sdist artifacts and runs `twine check`, the disabled
  publish workflow names the future PyPI policy instead of npm tokens, GitHub
  issue/PR templates ask for Python/CodeAlmanac details, and public-contract
  tests reject npm-era `.github/` wording.
- Slice 94 tightens the GitHub project-surface proof. `uv sync --locked`
  passed locally, the bug-report template now says CodeAlmanac in its expected
  behavior prompt, and public-contract tests parse `.github/workflows/*.yml`
  with `ruamel-yaml` before asserting the CI/package-check Python gate
  commands.
- Slice 95 splits deterministic sync policy out of `SyncWorkflow`.
  `workflows/sync/service.py` is now a 308-line orchestration surface that
  discovers candidates, scopes wikis, loads run records and ledgers, starts or
  queues ingest, and saves ledger changes. `workflows/sync/policy.py` owns
  ledger identity, transcript snapshot reading, cursor hashing, pending-entry
  transitions, pending-run reconciliation, skip rows, and generated cursor
  guidance. Architecture tests prevent the policy helpers from regrowing in
  `service.py` and prevent policy from importing orchestration services.
- Slice 103 keeps `workflows/sync/policy.py` as that facade while splitting
  deterministic policy by rule family: `decisions.py`, `entries.py`,
  `identity.py`, `snapshots.py`, `reporting.py`, and `guidance.py`.
  Architecture tests keep `SyncWorkflow` orchestration-only and keep the facade
  small.
- Slice 96 splits the filesystem source-runtime integration by responsibility.
  `integrations/sources/filesystem/adapter.py` remains the 191-line
  `SourceRuntimeAdapter` implementation, while `documents.py` owns text
  models/charset decoding, `listing.py` owns ignore/Git/walk directory
  material selection, `selection.py` owns diversity ranking, `rendering.py`
  owns prompt-facing runtime text, and `paths.py` owns shared path display
  helpers. The adapter normalizes `cwd` before delegation so symlinked temp or
  macOS `/var` paths still render repo-relative runtime paths. Architecture
  tests prevent charset, pathspec/Git walking, document Pydantic models, or
  rendering helpers from regrowing in `adapter.py`.
- Slice 104 splits the GitHub source-runtime integration by responsibility.
  `integrations/sources/github/adapter.py` remains the small
  `SourceRuntimeAdapter` implementation, while `client.py` owns `gh` command
  execution and typed payload retrieval, `models.py` owns Pydantic `gh --json`
  payloads, `targets.py` owns `SourceRef` target args, `rendering.py` owns
  prompt-facing PR/issue runtime text, and `errors.py` owns unavailable-runtime
  diagnostics. Architecture tests prevent payload models, process execution,
  target policy, and rendering helpers from regrowing in `adapter.py`.
- Slice 105 splits the transcript source-runtime integration by responsibility.
  `integrations/sources/transcripts/runtime.py` remains the small
  `SourceRuntimeAdapter` implementation, while `models.py` owns typed transcript
  line and entry models, `reader.py` owns JSONL file reading, `entries.py` owns
  known-provider line-to-entry normalization, `rendering.py` owns prompt-facing
  text and truncation, `paths.py` owns path resolution, and `errors.py` owns
  unavailable-runtime diagnostics. Architecture tests prevent provider models,
  JSONL reading, entry normalization, and rendering helpers from regrowing in
  `runtime.py`.
- Slice 106 splits source-address syntax out of `SourcesService`.
  `services/sources/service.py` remains the resolve/discover/inspect facade over
  request models and injected ports; `address_resolution.py` owns prompt hints,
  GitHub shorthand and URL parsing, git diff/range parsing, transcript address
  parsing, web URL validation, local path classification, and file
  fingerprinting; `transcripts.py` owns transcript discovery ordering.
  Architecture tests prevent URL parsing, hashing, and source-family resolver
  functions from regrowing in `service.py`.
- Slice 107 splits CLI render internals while preserving dispatcher imports.
  `cli/render/root.py` is now a small re-export facade; `lifecycle.py` owns
  build/ingest/garden/sync/job-start output, `wiki.py` owns
  search/show/topics/health/tagging output, `workspaces.py` owns local wiki
  registry list/drop output, and `common.py` owns shared JSON/index/page-word
  helpers. Architecture tests prevent service model imports and render function
  implementations from regrowing in `root.py`.
- Slice 108 splits filesystem directory listing internals while preserving
  source-runtime behavior. `integrations/sources/filesystem/listing.py` now
  assembles directory documents and chooses Git-vs-walk listing source;
  `ignore.py` owns default/configured ignore rules and `.gitignore` loading;
  `walk.py` owns Python recursive walking; `git.py` owns Git `ls-files`,
  status parsing, repo-root probing, and command tolerance. Architecture tests
  prevent `GitIgnoreSpec`, recursive walking, subprocess handling, and Git
  status parsing from regrowing in `listing.py`.
- Slice 109 splits sync run execution effects out of `SyncWorkflow.service`.
  `workflows/sync/service.py` now owns status/run/evaluate/scoping
  orchestration; `execution.py` owns foreground Ingest execution, background
  queueing, worker-spawn failure handling, pending/failed/absorbed ledger
  writes, and started summary rows. Architecture tests prevent execution
  request construction, queueing, worker spawn, pending writes, and terminal
  ledger transitions from regrowing in `service.py`.
- Slice 110 splits viewer workspace scope and payload projection out of
  `ViewerService` while preserving multi-wiki `serve` behavior.
  `services/viewer/workspace_scope.py` owns selected-wiki fallback,
  available-registry filtering, and workspace switcher ordering.
  `services/viewer/projections.py` owns index/workspace to viewer DTO
  conversion. Architecture tests prevent registry filtering and DTO
  construction from regrowing in `service.py`.
- Slice 111 splits web source runtime internals while preserving web URL
  material behavior. `integrations/sources/web/adapter.py` remains the
  `SourceRuntimeAdapter` implementation; `client.py` owns `httpx` streaming;
  `models.py` owns typed fetched-response/runtime-document models;
  `documents.py` owns content-kind classification and Beautiful Soup
  HTML/text extraction; `rendering.py` owns prompt-facing runtime text; and
  `errors.py` owns unavailable diagnostics. Architecture tests prevent the
  adapter from regrowing HTTP streaming, Pydantic models, parsing, and
  rendering helpers.
- Slice 112 splits workspace service mechanics while preserving configured-root
  and registry behavior. `services/workspaces/service.py` remains the use-case
  facade for initialization targets, registration, selection, resolution,
  validation, listing, and explicit drops. `identity.py` owns workspace names
  and ids, `selection.py` owns selector matching and path containment,
  `status.py` owns marker-based registry availability, and `store.py` owns
  registry JSON persistence without importing back from `service.py`.
  Architecture tests prevent id generation, selector mechanics, and
  marker-status policy from regrowing in `service.py`.
- Slice 97 splits run-ledger persistence by responsibility. `RunStore` remains
  the `RunsService` repository facade, while `services/runs/paths.py` owns
  run-id validation and path construction, `io.py` owns JSON record/spec and
  JSONL event mechanics, `locks.py` owns worker lock ownership, and
  `transitions.py` owns grouped record-plus-event writes. Transition tests
  prove that event append failure restores the previous record or removes an
  uncommitted queue spec. Architecture tests keep `store.py` under 280 lines
  and prevent JSON parsing, path validation, worker lock code, and append-file
  mechanics from moving back into the facade.
- Slice 98 splits the index read side by query family. `IndexStore` still
  imports from the small `services/index/views.py` facade, while
  `search_views.py` owns FTS/file-mention SQL, `summary_views.py` owns count
  summaries, `page_views.py` owns page detail projection, `topic_views.py` owns
  topic DAG reads, and `health_views.py` owns health findings. Architecture
  tests keep view modules read-only, keep `views.py` tiny, and prevent
  migrations, projection-write SQL, or page-document loading from entering the
  read side.
- Slice 102 splits the index write side by reason to change. `IndexStore`
  remains the service-facing facade, `schema.py` owns derived `index.db`
  schema/migrations/connection setup, `sources.py` owns markdown/topic source
  loading and freshness signatures, and `projection.py` owns replacement writes
  plus stored source signatures. Architecture tests keep schema, source loading,
  and projection SQL out of `store.py`.
- Source runtime covers filesystem paths, Git, GitHub, transcripts, and web
  URLs behind `services/sources/ports.py::SourceRuntimeAdapter`.
  `InspectSourceRuntimeRequest.context` carries workflow-owned runtime policy
  such as ignored workspace directories.
- `codealmanac.database` owns SQLite connection setup and migration
  application. `IndexStore` is a facade over index schema, source loading,
  projection writes, and read views; those responsibilities live in
  `services/index/schema.py`, `sources.py`, `projection.py`, and the query-
  family view modules.
- `services/config` owns local TOML config parsing and precedence. Project
  config is `<almanac-root>/config.toml`; CLI flags still win over config. It
  uses `pydantic-settings` TOML sources.
  The first supported fields are `[harness].default` and `[sync].quiet`.
- Slice 40 splits the CLI edge: `main.py` is thin, parser construction is under
  `cli/parser/` by command domain, and dispatch/render moved to
  `cli/dispatch/root.py` and `cli/render/root.py`.
- Slice 49 splits the admin CLI edge. `doctor`, `update`, `jobs`, and
  `automation` live under `cli/dispatch/admin.py` and `cli/render/admin.py`;
  shared CLI config/duration resolution lives in `cli/dispatch/config.py`.
- Slice 72 splits the rest of CLI dispatch by domain. `cli/dispatch/root.py` is
  a small delegator; lifecycle commands live in `cli/dispatch/lifecycle.py`;
  wiki/read commands live in `cli/dispatch/wiki.py`; architecture tests guard
  the root size and dispatch file size.
- Slice 73 extracts the shared page-writing lifecycle into
  `workflows/page_run/`. `IngestWorkflow` and `GardenWorkflow` keep
  operation-specific context and prompt preparation; `PageRunWorkflow` owns
  running-state transition, mutation preflight, harness calls, transcript/event
  recording, mutation validation, index refresh, terminal success, and failure
  recording. Architecture tests now prevent ingest/garden from importing the
  shared harness/run plumbing directly.
- Slice 74 restores the first jobs control surface in Python:
  `codealmanac jobs attach <run-id>` replays the durable run log and reports the
  current status, `codealmanac jobs cancel <run-id>` marks queued/running runs
  cancelled through `RunsService`, and `RunStore.finish(...)` preserves an
  already-cancelled record instead of resurrecting it as done or failed. This
  is the control seam the future queue/worker will use; it does not yet spawn
  background workers.
- Slice 75 restores the in-process background queue core. `RunsService.queue`
  persists executable `<run-id>.spec.json` files beside run records,
  `next_queued` selects the oldest queued run that has a spec, and per-wiki
  `worker.lock/owner.json` serializes worker drains with stale-lock recovery.
  `RunQueueWorkflow` dispatches persisted Ingest/Garden specs back through the
  existing operation workflows, so prompt construction, mutation preflight,
  harness execution, index refresh, and terminal state still live in the
  lifecycle path. Detached process spawning and public foreground/background
  lifecycle flags are still missing.
- Slice 76 exposes the queue core through explicit background lifecycle mode.
  `ingest --background` and `garden --background` enqueue a spec-backed run and
  spawn a detached worker through an injected spawner port. The real adapter
  runs `sys.executable -m codealmanac.cli.main __run-worker --cwd <repo>`;
  the hidden worker command drains through `RunQueueWorkflow`, so it remains an
  entrypoint rather than an internal API. Plain `ingest` and `garden` still run
  foreground until the default-mode product decision is made explicitly. Sync
  still runs foreground ingest in-process.
- Slice 77 adds explicit background sync mode. `sync --background` keeps sync
  responsible for transcript discovery, cursor decisions, and pending ledger
  claims, then queues an Ingest spec through `RunQueueWorkflow`, saves the
  pending claim linked to the queued run id, and only then spawns a worker.
  Plain `sync` remains foreground, and local automation still schedules
  foreground sync until unattended background policy is reopened.
- Slice 78 restores structured page source readback in the Python index. Page
  frontmatter remains canonical, `PageSource` is normalized before SQLite,
  `page_sources` is a derived projection, and source-health warnings stay
  report-only. No migration command, source catalog, or web snapshot machinery
  was added.
- Slice 99 keeps `sources[type=file].target` from silently losing file-aware
  retrieval by accepting generic `target:` as a parser fallback after the
  type-specific source fields.
- Slice 100 keeps Codex app-server behavior unchanged while splitting the
  provider-event mapper into named modules and adding an architecture guard for
  the new boundary.
- Slice 101 keeps Codex app-server behavior unchanged while splitting
  response, sandbox, turn-completion, timeout, and result-projection helpers out
  of the transport client.
- Slice 102 keeps index behavior unchanged while splitting schema, source
  loading, and projection writes out of the `IndexStore` facade.
- Slice 103 keeps sync behavior unchanged while splitting deterministic sync
  policy behind the existing `workflows/sync/policy.py` facade.
- Slice 104 keeps GitHub source-runtime behavior unchanged while splitting
  payload models, `gh` command execution, target arguments, rendering, and
  diagnostics out of the adapter.
- Filesystem directory runtime uses Git listing inside worktrees, then falls
  back to the bounded Python/pathspec walk outside Git.
- Directory runtime ranks changed and untracked files before unchanged files,
  interleaves clean directory groups, prefers role-bearing files, and labels
  included files as `changed` or `unchanged`.
- Public-contract tests guard the local-only CLI/package surface: only the
  `codealmanac` script, no hosted verbs, no compatibility aliases, and no
  `sdk` or `mcp` package modules. They also guard README/package metadata so
  old Node/npm, `almanac`, hosted-dashboard, and `absorb` language does not
  return.
- `README.md` now documents the Python local product surface: Python 3.12+,
  `codealmanac`, default `almanac/`, local install, local read commands,
  lifecycle commands, sync, automation, jobs, providers, configuration, and the
  no-hosted/no-alias public contract.
- Slice 57 real Codex ingest dogfood passed through `IngestWorkflow` and
  `CodexCliHarnessAdapter` in isolated temp repos. The first run exposed broken
  page links from over-eager entity wikilinking; prompt/manual guidance now
  says page links must resolve. A second real Codex run on the same source
  shape produced a page with no broken links. Starter scaffold topics were
  narrowed so fresh init no longer creates empty-topic health noise.
- Slice 58 real Claude ingest dogfood passed through `IngestWorkflow` and
  `ClaudeCliHarnessAdapter` in an isolated temp repo. It created
  `incident-window-policy.md`, updated `topics.yaml`, preserved mutation safety,
  produced readable `jobs logs`, and left `health --json` clean. Public CLI
  readback worked for jobs logs, search, show, and health. No code or prompt
  patch was needed.
- Slice 59 real sync dogfood passed against a temp Codex transcript and real
  Claude-backed Ingest. Sync discovered one ready transcript, started
  `ingest-20260629231810-40e74df3`, advanced the ledger to `done`, skipped the
  same transcript as `unchanged` on the second status run, produced
  `sync-workflow.md`, and left health clean. Public CLI readback worked for
  `sync status`, `jobs logs`, `jobs show`, `search`, `show`, and
  `health --json` when selected with `uv run --project` because the branch is
  not published yet.
- Slice 60 serve browser proof passed through browser-harness against a live
  temp `serve` instance. The desktop routes `/`, `#/page/auth-flow`,
  `#/topic/auth`, `#/search/auth`, and `#/file/src/auth/session.py` rendered the
  expected headings/content with no horizontal overflow. A 390px mobile
  `#/page/auth-flow` route also rendered page content and file refs with no
  horizontal overflow. No viewer code or CSS patch was needed.
- Slice 61 final package rehearsal passed from built artifacts. Wheel and
  sdist builds installed into clean Python 3.12.9 environments, installed CLI
  smoke passed for `init`, `search`, `show`, `topics`, `health`, `jobs`,
  `sync status`, `doctor`, and `serve`, and a Python 3.11 install failed as
  intended because the package requires `>=3.12`. Package metadata now uses
  SPDX `Apache-2.0` plus `license-files = ["LICENSE.md"]`.
- Slice 62 replaced the stale npm release guide with the Python/PyPI release
  guide, added PyPI-facing package metadata, and extended public-contract tests
  to reject old npm release commands. Current setuptools rejects license
  classifiers when SPDX `license = "Apache-2.0"` is present, so package
  classifiers intentionally omit `License :: OSI Approved :: Apache Software
  License`.
- The manual surface is a support package, not a public command. `ManualLibrary`
  reads `src/codealmanac/manual/*.md`, `build`/`init` copy missing docs into
  the configured root's `manual/`, prompts tell lifecycle agents to read those
  docs, and `doctor` checks package/workspace manual readiness. Slice 52 adds
  drift diagnostics: complete manual files that differ from bundled docs are
  reported as informational review work, not overwritten by build/init.
- `codealmanac list` is the local registry management surface. Plain `list`
  keeps the three-column output; `list --json` reports registry availability;
  `list --drop <selector>` removes one explicit entry; `list --drop-missing`
  explicitly removes unreachable entries. Read commands do not prune registry
  state silently.
- Page-writing lifecycle workflows record normalized harness events before
  later validation. `PageRunWorkflow` writes returned `HarnessEvent` values as
  soon as the harness returns, so failed harness runs remain visible in
  `jobs logs` even when the terminal run error is a mutation-safety failure.
  Codex now uses app-server notifications and Claude now uses SDK message
  streams for richer normalized events. The active rewrite goal still needs
  real-provider dogfood for both richer transports before the harness contract
  is release-proven against paid/live model runs.
- Foreground `sync` writes a durable pending ledger claim before invoking
  Ingest, skips active pending transcript ranges, reports stale pending ranges
  as needs-attention, stores linked run ids plus cursor snapshots, reconciles
  terminal linked runs before cursor evaluation, and clears pending fields on
  terminal success/failure.
- Scheduled sync is still foreground `sync` launched by automation. Automation
  passes a stable claim owner, pending timeout, and failed-attempt budget.
  `SyncLedgerEntry.failed_attempts` stops repeated failures at
  `sync-retry-budget-exhausted`.
- Run records now have an explicit lifecycle transition: queued at creation,
  running before Ingest/Garden side effects, then terminal done/failed/cancelled.
- Run cancellation is durable and idempotent. Terminal runs are not rewritten by
  `jobs cancel`; queued/running runs get a final `cancelled` status event; and
  later terminal `finish(...)` calls return the cancelled record unchanged.
- Ingest remains source-kind agnostic. It resolves `SourceBrief` values, asks
  `SourcesService.inspect_runtime(...)` for snapshots, renders typed runtime
  JSON into the prompt, calls the selected harness, validates wiki-root
  mutation safety, refreshes the index, and records the run. Normalized
  harness events are recorded before safety/success validation.
- The CLI remains a thin adapter. Do not shell out to `codealmanac` from
  workflows, automation, tests, or future server wrappers.

## Recent Slices

Slice 28 added `FilesystemSourceRuntimeAdapter` under
`integrations/sources/filesystem/`.

Behavior:

- supports `path.file`, `path.directory`, and `path.unknown`
- reads explicit text files with bounded bytes
- decodes file bytes through `charset-normalizer`
- returns unavailable runtime for missing or binary files
- walks directories lazily and stops after a file-count bound
- applies root `.gitignore` patterns through `pathspec`
- skips generated/private traversal paths such as `.git/`, `.almanac/`,
  `node_modules/`, virtualenv/cache directories, `.gitignore`, and `.env`
  files
- renders directory runtime as metadata, a compact tree, and included file
  sections
- makes ordinary `note.md` ingest prompt content available instead of skipped

Runtime dependencies added:

- `pathspec>=1.1.1`
- `charset-normalizer>=3.4.7`

Slice 29 added the manual `codealmanac update` command.

Behavior:

- detects install metadata through `importlib.metadata`
- supports uv tool installs with `uv tool upgrade codealmanac`
- supports pip installs with `python -m pip install --upgrade codealmanac`
- refuses editable/source installs with `run: git pull && uv sync`
- keeps update automation unscheduled until non-editable install dogfood exists

Slice 48 dogfooded non-editable update installs.

Behavior:

- pip-installed wheel metadata reports `installer: pip`
- pip update plans the throwaway venv Python command
- uv-tool-installed wheel metadata reports `installer: uv`
- uv-tool update plans `uv tool upgrade codealmanac`
- successful foreground package-manager execution returns status `completed`
  instead of over-claiming installed files changed
- scheduled update automation remains deferred until notifier cadence,
  dismissal behavior, and release-channel policy are agreed

Slice 30 added the viewer file route.

Behavior:

- `ViewerService.file(...)` uses the index mentions query to find pages that
  reference a file or folder
- `/api/file?path=src/foo.py` returns `ViewerFile` payloads
- frontend file refs in the right rail route to `#/file/<path>`
- parent traversal such as `../secret.txt` is rejected before querying
- the route is graph navigation, not source-code preview

Slice 31 added Git-backed filesystem directory listing.

Behavior:

- directory runtime runs `git ls-files -z --cached --others --exclude-standard`
  when the selected directory is inside a Git worktree
- nested `.gitignore`, `.git/info/exclude`, and global Git excludes are handled
  by Git rather than copied into Python
- CodeAlmanac still filters private/generated defaults such as `.almanac/`,
  `.env`, and `.gitignore`
- non-Git directories keep the old bounded Python/pathspec walk
- runtime metadata includes `listing_source: git` or `listing_source: walk`

Slice 32 adds changed-first directory selection.

Behavior:

- Git-listed directory runtime also asks `git status --porcelain=v1 -z` for the
  selected path
- changed and untracked files are ranked before unchanged files
- unchanged files keep deterministic content/path ordering
- runtime metadata includes `selection_policy: changed_first`
- the rendered tree annotates included files as `changed` or `unchanged`

Slice 33 adds public contract guards.

Behavior:

- `tests/test_public_contract.py` asserts the only project script is
  `codealmanac`
- parser tests reject hosted or alias commands such as `login`, `connect`,
  `upload`, `capture`, `absorb`, `use`, `sources`, `mcp`, and `sdk`
- package tree tests reject `sdk` and `mcp` Python modules

Slice 34 adds the local manual surface.

Behavior:

- `src/codealmanac/manual/` packages the wiki-maintenance rulebook
- `ManualLibrary` reads bundled docs, installs missing workspace manual files,
  and reports workspace completeness
- `app.py` wires `ManualLibrary` once and injects it into `WikiService` and
  `DiagnosticsService`
- `codealmanac init` and `codealmanac build` copy missing files into
  `<almanac-root>/manual/` without overwriting local edits
- `codealmanac doctor` reports `install.manual` and `wiki.manual`
- lifecycle prompts point agents at the configured root's `manual/` before wiki
  edits

Slice 35 adds sync pending claims.

Behavior:

- foreground `sync` writes a `PENDING` sync ledger entry before invoking Ingest
- pending entries record owner, start time, and claimed line range
- ledger keys use normalized transcript paths, and lookup can match stored
  entries by normalized app/session/transcript identity
- active pending entries are skipped by status/run
- stale pending entries surface as needs-attention instead of being skipped
  forever
- terminal success/failure clears pending fields
- this is not a full background retry/reconciliation loop

Slice 36 adds run lifecycle state.

Behavior:

- `RunsService.mark_running(...)` moves a queued run to running
- `RunStore` sets `started_at` and appends a `running` status event
- marking an already running run is idempotent
- marking a terminal run running raises a conflict
- Ingest and Garden mark their run records running before side-effecting work
- this prepares sync reconciliation but does not add a background queue or
  pending run id yet

Slice 37 adds sync pending run linkage.

Behavior:

- `IngestWorkflow.run(...)` keeps its public contract but now delegates to
  `start(...)` and `run_with_run(...)`
- foreground `sync` creates the Ingest run before claiming the transcript range
- pending sync ledger entries store `pending_run_id`, `pending_to_size`,
  `pending_prefix_hash`, and claimed line range
- `sync status` reports linked active runs as `sync-pending-run-active`
- `sync status` reports linked terminal done runs as `sync-pending-run-done`
- foreground `sync` promotes linked done pending cursors before checking for
  newer transcript bytes
- foreground `sync` clears failed/cancelled linked pending claims and retries
  from the last successful cursor when the transcript prefix still matches
- unlinked pending entries keep the existing active/stale timeout behavior

Slice 46 ports the serve visual system.

Behavior:

- local viewer uses UseAlmanac-inspired dashboard shell, left rail, account
  picker styling, search header, page list rows, wiki page surface, and side
  panel styling
- product IA stays local: overview, page, topic, search, and file-reference
  routes over repo-owned wiki pages
- no hosted account, billing, settings, or UseAlmanac hosted wiki routes
- do not copy the current UseAlmanac wiki page/search UX; preserve the
  sidebar-first local reader shape and improve the design layer around it
- browser-harness verified desktop page/search/file/wikilink navigation and
  mobile no-overflow behavior

Slice 47 modularizes the serve frontend.

Behavior:

- `app.js` is a tiny ES module entrypoint
- `server/assets/viewer/api.js` owns viewer HTTP calls
- `server/assets/viewer/routes.js` owns hash parsing and href builders
- `server/assets/viewer/components.js` owns shared DOM pieces
- `server/assets/viewer/renderers.js` owns page/search/topic/file screens
- `server/assets/viewer/main.js` wires browser events and state
- `/assets/{path}` validates and serves nested package assets
- React/Next.js remains deferred until real viewer complexity requires it

Slice 38 adds the database boundary.

Behavior:

- `src/codealmanac/database/` now exposes `connect_sqlite(...)`,
  `apply_migrations(...)`, and `SQLiteMigration`
- SQLite parent directory creation, row factory setup, `foreign_keys`, and
  `journal_mode=WAL` live in `database/`
- `services/index/store.py` supplies a typed rebuild migration for `index.db`
- `IndexStore` still owns the schema DDL, refresh/rebuild behavior, search SQL,
  topic SQL, health SQL, and row conversion
- `tests/test_architecture.py` rejects direct `sqlite3` imports outside the
  database package

Slice 39 adds the config boundary.

Behavior:

- `src/codealmanac/services/config/` now exposes Pydantic config models,
  `LoadConfigRequest`, `ConfigStore`, and `ConfigService`
- `ConfigStore` reads TOML through `pydantic-settings`
  `TomlConfigSettingsSource`
- `ConfigService` merges defaults, user config, and selected-project config
- `ingest`, `garden`, `sync`, `sync status`, and `automation install` resolve
  lifecycle defaults through `app.config`
- `tests/test_architecture.py` rejects `tomllib` imports outside
  `services/config`

Slice 40 splits the CLI edge.

Behavior:

- `src/codealmanac/cli/main.py` owns parser invocation, app construction,
  dispatch, and known error formatting only
- parser construction lives under `cli/parser/` by command domain
- dispatch and render live under `cli/dispatch/root.py` and
  `cli/render/root.py`
- architecture tests keep `main.py` and parser root thin

Slice 41 adds configurable Almanac roots.

Behavior:

- first-time `codealmanac init` and `codealmanac build` default to
  `--root almanac`
- existing registered repos keep their registered root when `--root` is omitted
- setup can explicitly use `--root docs/almanac`
- `WorkspaceRegistryEntry` stores `almanac_root`
- `WorkspacesService.resolve(...)` discovers default roots plus roots already
  present in the registry
- `codealmanac list` prints name, repo path, and configured root
- `WikiService`, index, runs, sync ledger, config, prompts, and manual surfaces
  resolve through `workspace.almanac_path`
- transcript candidates now carry `almanac_path`
- index health receives the true repo root rather than assuming
  `almanac_path.parent`

Slice 42 adds source runtime context.

Behavior:

- `SourceRuntimeContext` carries repo-relative ignored directories into source
  runtime inspection
- Ingest sets that context from `workspace.almanac_root`
- filesystem directory runtime applies the ignored directories in both Git and
  non-Git traversal
- filesystem runtime no longer treats `almanac/` or `docs/almanac/` as
  universal ignore names

Slice 43 adds scheduled sync retry policy.

Behavior:

- automation installs scheduled sync with `--claim-owner
  codealmanac.automation.sync`, `--pending-timeout 24h`, and
  `--max-failed-attempts 3`
- sync ledger entries record `failed_attempts`
- failed Ingest attempts increment the counter
- successful absorb resets the counter
- exhausted failed entries report `sync-retry-budget-exhausted` instead of
  retrying forever

Slice 44 adds clean directory diversity.

Behavior:

- filesystem runtime selection is a pure adapter-local ranking core after
  Git/walk I/O has produced candidates
- changed and untracked files still rank before unchanged files
- unchanged file selection interleaves directory groups before taking a second
  file from the same group
- role-bearing files such as `service.py`, `adapter.py`, `app.py`, and
  `main.py` rank ahead of generic source files inside a group
- Git directory metadata now reports `selection_policy: changed_then_diverse`

Slice 45 locks viewer wikilink token safety.

Behavior:

- `MarkdownRenderer` parses CommonMark with `markdown-it-py`
- wikilink rewriting only rewrites inline child tokens with type `text`
- inline code and fenced code containing `[[...]]` remain code text
- wikilink labels render through text tokens, so HTML in labels is escaped
- server and viewer service layers do not perform raw HTML string rewrites

## Verification To Preserve

- Focused filesystem/source/ingest/architecture tests
- Focused ruff over source integrations and touched tests
- Full pytest
- Full ruff
- `git diff --check`
- Package build with wheel inspection for filesystem adapter and new metadata
  dependencies
- Dogfood with a temp Git repo, local `notes.md` and `src/` inputs, real
  default filesystem runtime, fake harness, and search readback
- Slice 29 focused update service/CLI/architecture tests
- Slice 29 focused ruff
- Slice 29 live editable-install checks:
  `update --check`, `update --check --json`, and default `update` refusing
  mutation
- Slice 30 focused viewer/server tests, full pytest, full ruff, diff check,
  package build asset inspection, and live `serve` API dogfood for file,
  folder, traversal rejection, and frontend asset wiring
- Slice 31 focused filesystem/source/ingest/architecture tests and focused ruff
- Slice 32 focused filesystem tests, source/ingest/architecture tests, focused
  ruff, and dirty-checkout dogfood against `src/codealmanac/`
- Slice 33 public-contract tests, focused CLI/architecture tests, full pytest,
  full ruff, diff check, package build, and live CLI help smoke
- Slice 34 manual/build/doctor/prompt tests, full pytest, full ruff, diff
  check, package build with manual Markdown wheel inspection, and isolated
  build/doctor manual dogfood
- Slice 35 sync pending tests, full pytest, full ruff, diff check, and pending
  claim dogfood
- Slice 36 run lifecycle tests, full pytest, full ruff, diff check, and live
  run-status dogfood
- Slice 37 sync pending run-linkage tests, ingest regression tests, full
  pytest, full ruff, diff check, and live sync reconciliation dogfood
- Slice 38 database helper tests, read-model regression tests, architecture
  boundary test, full pytest, full ruff, diff check, and live build/search
  dogfood
- Slice 39 config service tests, CLI default-resolution tests, architecture
  boundary test, full pytest, full ruff, diff check, and live config dogfood
- Slice 40 focused CLI/public-contract/architecture tests, full pytest, full
  ruff, diff check, package build, CLI help smoke, and temp build/search
  dogfood
- Slice 41 focused root/config/sync/lifecycle/CLI tests, full pytest, full
  ruff, diff check, package build, and temp build/search dogfood with default
  `almanac/`
- Slice 42 focused filesystem/source/ingest tests, full pytest, full ruff,
  diff check, package build, and custom-root source-runtime dogfood
- Slice 43 focused sync/automation/CLI tests, full pytest, full ruff, diff
  check, package build, and retry-budget dogfood
- Slice 44 focused filesystem selection/runtime tests, full pytest, full ruff,
  diff check, package build, and source-runtime dogfood against
  `src/codealmanac/`
- Slice 45 focused viewer renderer/service/server tests, full pytest, full
  ruff, diff check, package build, and renderer dogfood snippet
- Slice 46 focused viewer/server tests, focused ruff, browser-harness desktop
  page/search/file/wikilink navigation, and browser-harness mobile no-overflow
  checks
- Slice 47 focused server/viewer tests, focused server ruff, nested asset route
  tests, and package-data preparation for wheel inspection
- Slice-47 review fix focused server/viewer tests, focused server ruff, diff
  check, and browser-harness malformed-hash dogfood
- Slice 49 focused architecture/admin CLI tests, focused CLI ruff, full pytest,
  full ruff, diff check, package build, wheel inspection, and live admin CLI
  dogfood for update, doctor, automation, jobs, and help
- Slice 50 focused read-view tests, focused index lint, temp-repo CLI read
  dogfood, full pytest, full ruff, diff check, package build, and wheel
  inspection
- Slice 51 focused serve/static tests, full pytest, full ruff, diff check,
  package build, static/API serve dogfood, and browser-harness desktop/mobile
  verification through an isolated Chrome profile
- Slice 52 focused manual/diagnostics/CLI tests, focused ruff, full pytest,
  full ruff, diff check, package build, and manual-drift doctor dogfood
- Slice 53 focused workspace/CLI tests, focused ruff, source-runtime dogfood
  against this repo, full pytest, full ruff, diff check, package build, and
  list JSON/drop/drop-missing dogfood
- Slice 54 focused ingest/garden workflow tests, focused lifecycle ruff,
  full pytest, full ruff, diff check, package build, and harness-failure-log
  dogfood
- Slice 55 focused harness/adapter/workflow tests, focused ruff, full pytest,
  full ruff, diff check, package build, and normalized-harness-event jobs-log
  dogfood
- Slice 56 focused public-contract tests, focused ruff, full pytest, full ruff,
  diff check, package build, wheel metadata inspection, and clean wheel install
  CLI dogfood
- Slice 57 focused prompt/manual/build tests, two real Codex ingest dogfood
  runs, and health checks showing the prompt fix removed broken page links
- Slice 58 real Claude ingest dogfood, public CLI readback for jobs/search/show
  /health, and Relayforge Discord note through Doppler `almanac/dev`
- Slice 59 real sync dogfood, repeat unchanged-skip proof, clean health, and
  public CLI readback for sync/jobs/search/show/health
- Slice 60 browser-harness proof for live `serve` desktop overview/page/topic
  /search/file routes and mobile page route
- Slice 61 final wheel/sdist package rehearsal from clean Python 3.12.9
  installs, including installed CLI smoke and package metadata inspection
- Slice 62 Python release guide update, package metadata guards, and
  `twine check` package metadata verification
- Slice 63 missing-root hygiene, marker-based Almanac root availability, full
  pytest/ruff, diff check, and live CLI dogfood proving `doctor` does not
  recreate a deleted configured root
- Slice 64 README scaffold accuracy, public-contract guard for init-created
  source files versus derived runtime state, and live temp `init` tree dogfood
- Slice 65 README quickstart dogfood, public-contract guard for the starter
  search term, and live temp proof that `search "getting"` returns
  `getting-started` after init
- Slice 66 README lifecycle source-example check, public-contract guard that
  examples parse and resolve `README.md` as a real file plus `github:pr:123`
  as a PR source
- Slice 67 next-agent brief freshness guard; public-contract tests now require
  this brief's current-state section to mention the newest
  `docs/python-port/slice-N-*.md` file
- Slice 68 public beta gate audit; every public beta gate now has status,
  evidence, and remaining risk recorded in
  `docs/python-port/public-beta-gate-audit.md`, with a public-contract guard
  that the audit covers every gate row
- Slice 69 current-head package rehearsal; wheel and sdist artifacts built
  from current HEAD, passed `twine check`, package-data inspection, clean
  Python 3.12.9 installs, installed CLI smoke, live `serve` HTTP checks, and
  installed `update --check`
- Slice 81 focused viewer/server tests, focused ruff, full pytest, full ruff,
  diff check, and live multi-wiki serve API dogfood
- Slice 83 focused Codex adapter/app-server tests, focused architecture/harness
  tests, focused ruff, fake app-server protocol dogfood, full pytest, full
  ruff, and diff check
- Slice 84 focused Claude adapter SDK-stream tests, neighboring harness/workflow
  tests, focused ruff, full pytest after docs freshness update, full ruff, and
  diff check
- Slice 85 focused Claude adapter and architecture tests, focused ruff, full
  pytest, full ruff, and diff check
- Slice 85 review fix focused Claude adapter and architecture tests, focused
  ruff, full pytest, full ruff, and diff check
- Slice 93 GitHub Python automation, public-contract guards, package build
  artifact ignore, wheel build dogfood, full pytest, full ruff, and diff check
- Slice 94 GitHub workflow parse/command contract guard, exact `uv sync
  --locked` proof, focused/full pytest, focused/full ruff, and diff check
- Slice 99 source target fallback, parser/read-model/public-contract focused
  pytest, focused ruff, isolated CLI dogfood proving
  `sources[type=file].target` powers `search --mentions` and `show --json`,
  full pytest, full ruff, and diff check
- Slice 100 Codex event-boundary split, focused Codex app-server/Codex adapter
  and architecture tests, focused Ruff over Codex harness and architecture
  tests, fake app-server client dogfood, then full pytest/full Ruff/diff check
- Slice 101 Codex app-server client-boundary split, focused Codex app-server,
  Codex adapter, and architecture tests, focused Ruff over Codex harness and
  architecture tests, fake app-server client dogfood, then full pytest/full
  Ruff/diff check
- Slice 102 index store boundary split, focused architecture/read-model tests,
  focused Ruff over index modules and architecture tests, then full pytest/full
  Ruff/diff check
- Slice 103 sync policy boundary split, focused sync workflow and architecture
  tests, focused Ruff over sync modules and architecture tests, public
  `sync status --json` dogfood against a temp Codex transcript, then full
  pytest/full Ruff/diff check
- Slice 104 GitHub source-runtime boundary split, focused GitHub runtime,
  ingest, and architecture tests, focused Ruff over GitHub runtime and tests,
  fake-runner source-runtime dogfood, then full pytest/full Ruff/diff check
- Slice 105 transcript source-runtime boundary split, focused transcript
  runtime, sync, and architecture tests, focused Ruff over transcript runtime
  and tests, service-level transcript runtime dogfood, then full pytest/full
  Ruff/diff check
- Slice 106 source address resolution boundary split, focused source service,
  source runtime, and architecture tests, focused Ruff over `services/sources`,
  service-level source-resolution dogfood, then full pytest/full Ruff/diff check
- Slice 107 CLI render facade split, focused CLI and architecture tests,
  focused Ruff over CLI render/dispatch/parser, public CLI dogfood for help,
  init, list JSON, and empty search, then full pytest/full Ruff/diff check
- Slice 108 filesystem listing boundary split, focused filesystem runtime,
  directory-selection, and architecture tests, focused Ruff over filesystem
  source modules, service-level filesystem directory dogfood, then full
  pytest/full Ruff/diff check
- Slice 109 sync execution boundary split, focused foreground/background/failure
  sync tests, focused Ruff over sync modules, public `sync status --json`
  dogfood, then full pytest/full Ruff/diff check
- Slice 110 viewer service boundary split, focused viewer/server/architecture
  tests, focused Ruff over viewer/server modules, live two-wiki `serve` API
  dogfood, then full pytest/full Ruff/diff check
- Slice 111 web source runtime boundary split, focused web runtime, Ingest, and
  architecture tests, focused Ruff over web runtime modules, service-level
  `SourcesService` web dogfood with `httpx.MockTransport`, then full pytest,
  full Ruff, and diff check
- Slice 112 workspace service boundary split, focused workspace/build/read
  model/architecture tests, focused Ruff over workspace modules, service-level
  workspace dogfood for configured-root init/select/drop, then full pytest,
  full Ruff, and diff check

## Next Move

1. Likely next pressure points:
   - real-provider dogfood for the richer Codex app-server and Claude SDK
     transports, once model-call cost is acceptable
   - final publish operations: version/changelog, PyPI credentials, and human
     publish decision; slice 93 fixed the stale GitHub npm automation, but the
     publish workflow is intentionally disabled until a PyPI policy is chosen
   - one more lifecycle dogfood for prompt quality and real project behavior; add
     source-runtime ranking/recency only after a failing case proves current
     diversity is insufficient
   - scheduled update automation only after non-editable update dogfood
   - serve visual polish only after product review; slice 81 restored
     multi-wiki local scope, while slice 51/60 browser-verified the sidebar
     shell through an isolated temporary Chrome profile
   - manual replacement policy only if users need a workflow for accepting
     bundled doctrine changes; doctor now reports drift, while build/init still
     copy missing files only
   - index refresh cost only after large-repo dogfood proves source-signature
     parsing is too slow; slice 50 split read views but did not optimize refresh
   - richer registry filtering only if local wiki management needs more than
     explicit JSON/drop/drop-missing
2. Do not add hosted CLI, login/connect/upload, cloud capture/upload, MCP, SDK,
   public `capture`, public `absorb`, or public `almanac`/`alm` aliases.
3. Keep future source material additions inside `SourceAddress -> SourceRef ->
   SourceBrief -> SourceRuntime` unless the live agreement changes.
4. Browser-harness note from 2026-06-29: Chrome remote debugging is available
   in this workspace. Slice 46 verified `serve` with browser-harness on
   desktop and mobile. Keep using browser-harness for future visual changes.
