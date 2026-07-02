# CodeAlmanac Python Port Live Agreement

This file records the active agreement for the Python rewrite of CodeAlmanac.
It is the constraint document for future agents.

## Current Decisions

- 2026-06-29: Python v1 is a local product. Do not build hosted shipping,
  hosted CLI, login/connect/upload, SDK, or MCP in this rewrite.
- 2026-06-29: The branch may contain merged `dev` / `origin/dev` work that
  assumes hosted shipping. Treat that work as reference or archive material,
  not as product direction for this rewrite.
- 2026-06-29: The old TypeScript/Node implementation is archived under
  `archive/code/`. Use it as behavior reference, not as code to preserve.
- 2026-07-01: "Behavior reference" means the archived product behavior should
  be ported unless a decision below explicitly drops it. The Python rewrite is
  allowed to improve architecture and naming, but it must not silently simplify
  away setup UX, lifecycle semantics, harness events, page provenance, or
  viewer scope.
- 2026-06-29: Public command, package, and user-state language is
  `codealmanac`. Do not call the product Codex Almanac, and do not add public
  `almanac` or `alm` aliases for compatibility. Python identifiers may use
  normal class-name casing such as `CodeAlmanac`.
- 2026-06-29: The Python rewrite targets new CodeAlmanac users. Do not keep
  TypeScript-era backward compatibility, legacy aliases, legacy root
  migrations, or old frontmatter repair paths unless the user explicitly
  reopens that decision.
- 2026-07-02: There is no public `codealmanac build` command in Python v1.
  `codealmanac init` is the public first-build lifecycle command: it creates or
  refreshes the configured Almanac root, installs the wiki manual, and runs the
  initial agent-backed wiki construction. Use `codealmanac reindex` for derived
  SQLite read-model refreshes. "Build" may remain an internal concept for the
  first-build prompt/workflow only if it does not leak as a separate CLI verb.
- 2026-07-02: Restore the archived prompt/manual doctrine closely. Port
  `archive/code/prompts/base/*` and operation prompts into Python package
  resources with only deliberate adaptations: product name `codealmanac`,
  configured Almanac roots instead of hard-coded `.almanac/`, public `ingest`
  instead of `absorb`, and explicitly dropped archive lineage fields. Do not
  replace the archive prompt system with thin summaries.
- 2026-07-01: The intentionally dropped archive-era surfaces are: public
  `almanac`/`alm` compatibility bins, hosted login/connect/upload/MCP/SDK
  surfaces, migration commands unless a migration need becomes concrete, and
  the `review` command family for now. `setup`, `uninstall`, structured page
  `sources:`, multi-wiki `serve`, background jobs, and rich harness events are
  not intentionally dropped.
- 2026-06-29: "Frontmatter rewrite" means deterministic editing of current
  page metadata such as `topics:` while preserving page body text. It is not a
  compatibility layer for old page formats.
- 2026-06-29: Repo-owned wiki data lives under a configurable repo-local
  Almanac root. New Python installs default to `almanac/`, not `.almanac/`.
  Users may configure another root such as `docs/almanac/`.
  The chosen root owns committed wiki docs and local runtime artifacts,
  including the SQLite index, unless a future decision splits runtime state
  elsewhere.
- 2026-07-01: Current-repo auto-detection prefers the nearest initialized wiki
  root on disk over broad parent registry entries. The conventional roots
  `almanac/`, `docs/almanac/`, and `.almanac/` are detected by the
  `topics.yaml + pages/` marker shape; other custom roots become discoverable
  after registration. Registry entries are still never auto-dropped.
- 2026-06-30: Global user state belongs to `~/.codealmanac/`. The repo-local
  folder may be named `almanac/`; user config, registry state, and scheduler
  logs use the product-specific hidden directory.
- 2026-06-29: Follow Almanac's Python style: service symmetry, explicit request
  models, service-owned verbs, store-owned persistence, thin CLI edges.
- 2026-07-01: CLI render follows the parser/dispatch/render domain split.
  `cli/render/root.py` is a small re-export facade for dispatcher stability.
  `cli/render/wiki.py` is a wiki-render facade only; `search.py` owns
  search/reindex output, `pages.py` owns show/page output, `topics.py` owns
  topic output, `health.py` owns health output, and `tagging.py` owns
  tag/untag output. `lifecycle.py` owns lifecycle/sync/job-start output,
  `workspaces.py` owns local wiki registry list/drop output, and
  `cli/render/admin.py` is an admin-render facade only; `automation.py` owns
  automation output, `diagnostics.py` owns doctor output, `jobs.py` owns jobs
  output, `updates.py` owns update output, and `setup.py` owns setup/uninstall
  output plus Rich presentation. `common.py` owns shared formatting helpers.
- 2026-07-01: Wiki CLI dispatch follows the same command-family split.
  `cli/dispatch/wiki.py` remains the wiki-command facade for
  search/show/health/reindex/tag/untag routing. `topics.py` owns topic
  subcommand request construction, `workspaces.py` owns list/drop/drop-missing,
  and `serve.py` owns local viewer startup. Do not move topic request
  construction, workspace drop request construction, or uvicorn startup back
  into `dispatch/wiki.py`.
- 2026-07-01: Lifecycle CLI dispatch follows the same command-family split.
  `cli/dispatch/lifecycle.py` remains the lifecycle-command facade;
  the init/first-build dispatcher owns init request construction,
  `operations.py` owns ingest/garden foreground/background dispatch, `sync.py`
  owns sync and sync status request construction, and `worker.py` owns the
  hidden queue-drain entrypoint. Do not move workflow request construction,
  sync source parsing, or worker-drain request construction back into
  `dispatch/lifecycle.py`.
- 2026-07-01: Admin CLI parser construction follows the same command-family
  split. `cli/parser/admin.py` remains the admin-parser facade; `setup.py`
  owns setup/uninstall flags, `diagnostics.py` owns doctor flags, `updates.py`
  owns update flags, `jobs.py` owns jobs flags, and `automation.py` owns
  automation flags and task choices. Do not move command flag construction
  back into `parser/admin.py`.
- 2026-06-30: Validation belongs at product boundaries. Use Pydantic request,
  settings, and domain models for shaped data; use enums or literals for finite
  choices; reject invalid user/product input with explicit errors. Adapter-local
  tolerance can use small built-in parsers that return `None` for loose
  outside-world state, such as reading an existing launchd plist.
- 2026-06-29: Public-release readiness is now evidence-gated in
  `docs/python-port/public-release-readiness.md`. Further work should bias
  toward clean-install proof, real lifecycle dogfood, prompt quality, package
  metadata, README accuracy, and browser verification instead of adding
  speculative architecture seams.
- 2026-07-01: Background jobs are in scope for v1. Restore the archived
  machinery in Python shape: per-wiki queue, worker lock, background process
  owner, durable job/run spec and record files, append-only event logs, attach,
  cancel, stale-lock handling, and safe foreground execution when explicitly
  requested. Automation may schedule commands, but the implementation should
  call workflow/services directly rather than shelling out internally.
- 2026-06-29: Manual `update` is a foreground package-manager command and has
  pip/uv non-editable install dogfood. Do not schedule `update` until an
  explicit update-notification policy exists.
- 2026-06-29: There is no cloud capture surface in Python v1.
  `codealmanac update` updates the installed CLI package only. `sync` scans
  local transcripts and runs local ingest. `automation` schedules local
  `sync`/`garden`. Do not add public `capture`, cloud upload, hosted
  connection, login, or remote collection commands without a new agreement.
- 2026-06-29: `sync` writes a durable pending ledger claim before it invokes
  Ingest. Active pending claims skip that transcript; stale pending claims
  surface as needs-attention; terminal success or failure clears the pending
  fields. With background jobs enabled, sync can enqueue ingest work while the
  ledger records pending ownership and later reconciles terminal run state.
- 2026-06-29: `runs` owns lifecycle state transitions. Run records start as
  `queued`, workflows explicitly mark them `running`, and only terminal
  finish calls may move them to `done`, `failed`, or `cancelled`.
- 2026-07-01: `jobs attach` and `jobs cancel` are public control verbs over the
  run ledger. Cancellation is durable run state, not a CLI-side file edit.
  Terminal runs are cancel no-ops; queued or running runs append a `cancelled`
  status event. Terminal finish calls must preserve an already-cancelled run
  rather than rewriting it as done or failed.
- 2026-07-01: Python `jobs attach` streams through a service-owned use case.
  `services/runs/streaming.py` polls `RunStore.attach(...)`, emits only new log
  events, and stops at `done`, `failed`, or `cancelled`; CLI rendering owns
  text and JSON-line output. `jobs logs` remains the snapshot command.
- 2026-07-01: Run ledger persistence is split by responsibility. `RunStore`
  remains the service-facing repository facade. `services/runs/paths.py` owns
  run-id validation and path construction; `io.py` owns JSON record/spec and
  JSONL event file mechanics; `locks.py` owns worker lock ownership;
  `transitions.py` owns grouped record-plus-event transition writes;
  `factory.py` owns run-id and initial `RunRecord` construction; and
  `queries.py` owns sorted record listing and spec-backed queue selection. Do
  not regrow path validation, worker lock mechanics, JSON parsing, manual
  record/event pair writes, run-id construction, log-path construction, or
  queue-selection sorting inside `store.py`.
- 2026-07-01: Background queue membership is "queued run with a durable
  `<run-id>.spec.json`", not merely any run whose status is `queued`.
  Foreground lifecycle runs also begin as `queued`, so workers must select only
  spec-backed runs. The queue core owns durable specs, oldest spec-backed
  selection, per-wiki `worker.lock/owner.json`, stale-lock recovery, and
  in-process draining through existing Ingest/Garden workflows. Detached worker
  spawning and public foreground/background flags remain a later slice.
- 2026-07-01: Public background lifecycle execution is opt-in for now.
  `ingest --background` and `garden --background` enqueue spec-backed runs and
  spawn a detached local worker through an injected worker-spawner port. The
  hidden `__run-worker` command is a process entrypoint that calls
  `RunQueueWorkflow.drain(...)`; it is not a public command and it does not
  contain lifecycle business logic. Plain `ingest` and `garden` still run
  foreground until the default-mode product decision is made explicitly.
- 2026-07-01: `sync --background` enqueues eligible transcript ingests and
  saves pending ledger claims linked to queued run ids before spawning local
  workers. Plain `sync` remains foreground, and scheduled automation still
  launches foreground `sync` until unattended background policy is reopened
  explicitly.
- 2026-07-01: Shared page-writing lifecycle execution belongs to
  `PageRunWorkflow`. Operation workflows such as `ingest` and `garden` prepare
  operation-specific context and prompts, then delegate running-state
  transition, mutation preflight, harness invocation, harness transcript/event
  recording, mutation validation, index refresh, terminal success, and failure
  recording to the page-run workflow. Do not move this harness/run plumbing
  back into individual operation workflows.
- 2026-07-01: Shared lifecycle helper responsibilities are split behind the
  import-compatible `workflows/lifecycle.py` facade. `lifecycle_mutation.py`
  owns Git/workspace mutation preflight, reported-change validation, path-diff
  comparison, and Almanac-root safety checks. `lifecycle_harness.py` owns
  harness result validation, terminal fallback events, harness-event to
  run-event classification, and first-line failure summaries. Do not regrow
  mutation mechanics or harness classification inside the facade.
- 2026-06-29: Lifecycle workflows record returned harness status/output before
  mutation-safety validation and harness success validation. A failed harness
  run should leave an `output` event in `jobs logs` even when the terminal run
  error is a later safety failure.
- 2026-07-01: The inspectable transcript surface is a CodeAlmanac-owned
  normalized harness event stream, not raw provider transcript files. Port the
  archived harness event model: text, tool use/results, usage, provider
  session, done/failure details, and agent trace events where the provider can
  expose them. Codex should use the Codex app-server harness, not `codex exec`,
  for the main lifecycle path. Claude should use the richer SDK/event harness,
  not only the one-shot CLI print path, when porting archive behavior.
- 2026-07-01: The first rich event-log layer is implemented in Python:
  `HarnessEvent` can carry structured tool display, actor attribution, usage,
  provider session, failure metadata, agent trace, and raw JSON fields, and
  `RunLogEvent` persists an optional nested `harness_event` payload beside the
  readable log row.
- 2026-07-01: The service-owned harness contract is split by product meaning.
  `kinds.py` owns provider/status enums, `actors.py` owns root/helper
  attribution, `events.py` owns normalized transcript event payloads, and
  `results.py` owns readiness, transcript refs, run results, and terminal
  helper events. `models.py` is only an import-compatible facade; do not regrow
  the old mixed model module.
- 2026-07-01: The default Python Codex harness now uses
  `codex app-server --listen stdio://`, not `codex exec`. The adapter keeps
  readiness probing at `codex login status`, but lifecycle execution goes
  through the app-server JSON-RPC client with `mcp_servers={}`, ephemeral
  threads, noninteractive approval/user-input responses, workspace-write
  sandboxing with network disabled, root-turn completion, helper-turn error
  isolation, usage parsing, and normalized text/tool/warning/error/done events.
- 2026-07-01: Codex app-server event normalization is split by provider-edge
  responsibility. `events.py` remains the small notification dispatcher;
  `state.py` owns mutable run state; `actors.py` owns root/helper attribution;
  `item_events.py` owns item and output mapping; `agent_events.py` owns helper
  lifecycle traces; and `result.py` owns provider-session, usage, turn
  completion, and done events. Do not regrow one Codex event monolith.
- 2026-07-01: Codex app-server transport orchestration is split from provider
  policy helpers. `app_server.py` owns process startup, handshake requests,
  JSON-RPC reads, and turn flow. `responses.py` owns noninteractive
  server-request responses; `sandbox.py` owns sandbox mode/env policy and
  payload construction; `turn_completion.py` owns root-turn completion
  detection; `run_result.py` owns `CodexRunState`/failure to
  `HarnessRunResult` projection; and `timeouts.py` owns tolerant timeout-env
  parsing.
- 2026-07-01: Real Codex app-server dogfood proved the installed app-server can
  drive a full local Ingest lifecycle through the Python harness. The run first
  exposed that real `item/agentMessage/delta` notifications may be
  whitespace-only; the provider edge now drops blank text/plan deltas before
  constructing `HarnessEvent` because normalized harness events require
  non-empty messages.
- 2026-07-01: The default Python Claude harness now uses `claude-agent-sdk` for
  lifecycle execution, not `claude -p --output-format json`. The adapter keeps
  readiness probing at `claude auth status` with `ANTHROPIC_API_KEY` fallback
  when the CLI exists but is not logged in. Runs use isolated SDK options
  (`setting_sources=[]`, `strict_mcp_config=True`, `mcp_servers={}`,
  `permission_mode="dontAsk"`) and map typed SDK messages into normalized
  provider-session, text, tool, usage, helper-agent, error, and done events.
- 2026-07-01: Real Claude SDK dogfood proved the installed SDK and Claude CLI
  auth path can drive a full local Ingest lifecycle through the Python harness.
  The service-level run used `create_app(AppConfig(registry_path=<tmp>))`,
  real HOME/Claude auth, and a temp repo; run
  `ingest-20260701163930-cf193a0e` finished `done`, created
  `release-package-smoke.md`, search found the page, and health was clean.
  Normalized harness events included provider session, text, text deltas,
  tool use/results, context usage, warning, and done.
- 2026-07-01: The default lifecycle harness is Codex. Docs, config defaults,
  setup recommendations, and no-flag lifecycle behavior must agree on that.
- 2026-06-29: Sync pending claims store the run id plus claimed byte/line
  cursor. `sync status` reports active linked runs separately from terminal
  linked runs that need reconciliation. Foreground `sync` reconciles terminal
  linked runs against the run ledger before deciding whether newer transcript
  bytes still need Ingest.
- 2026-06-29: Scheduled sync is ordinary foreground `sync` launched by local
  automation with explicit unattended policy: a stable claim owner, pending
  timeout, and failed-attempt budget. Repeated failed transcript ingests stop
  at needs-attention instead of retrying forever.
- 2026-07-01: Sync orchestration, candidate evaluation, deterministic policy,
  and run execution are separate. `SyncWorkflow` remains the public facade for
  `status`, `run`, and `evaluate`, but it does not own transcript discovery,
  wiki scoping, run-record lookup, candidate evaluation, or execution effects.
  `workflows/sync/evaluation.py` owns transcript discovery, explicit `--wiki`
  scoping, run-record lookup, ledger load/save for pending reconciliation,
  cursor decisions, ready/skipped/attention rows, work-item construction, and
  summary assembly. Do not move these mechanics back into `service.py`.
- 2026-07-01: `workflows/sync/policy.py` remains the facade for deterministic
  sync policy. `decisions.py` owns cursor and pending-run decisions,
  `entries.py` owns ledger-entry transitions, `identity.py` owns
  workspace/session/ledger identity helpers, `snapshots.py` owns transcript
  snapshot reading and hashes, `reporting.py` owns skip/start rows, and
  `guidance.py` owns generated cursor guidance. Policy modules must not import
  provider integrations or service objects.
- 2026-07-01: Sync run execution effects are split from sync selection.
  `workflows/sync/execution.py` owns foreground Ingest execution, background
  queueing, worker-spawn failure handling, pending/failed/absorbed ledger
  writes, and started summary rows. Do not move lifecycle execution effects
  into `service.py` or `evaluation.py`.
- 2026-07-01: Topic read orchestration and topic mutation mechanics are
  separate. `TopicsService` remains the service-facing facade for list/show and
  mutation verbs. `services/topics/mutations.py` owns topic file loading,
  graph invariant checks, page frontmatter topic rewrites, topic-file writes,
  and index refresh after topic writes. Do not move topic YAML or page
  frontmatter rewrite mechanics back into `services/topics/service.py`.
- 2026-07-01: Diagnostics is split by check family. `DiagnosticsService`
  remains the service-facing `doctor` facade. `diagnostics/install.py` owns
  install/runtime/manual-package checks, `diagnostics/wiki.py` owns selected
  wiki readiness checks, and `diagnostics/messages.py` owns shared doctor
  message formatting. Do not move `doctor` mechanics back into `service.py`.
- 2026-07-01: Automation service orchestration is split from scheduler job
  construction. `AutomationService` remains the service-facing install,
  uninstall, and status facade. `services/automation/selection.py` owns task
  defaulting and install-selection validation; `definitions.py` owns static
  task metadata; and `jobs.py` owns `ScheduledJob` construction, command argv,
  plist path, launch PATH, interval, and working-directory resolution. Do not
  move scheduler command construction or selection validation back into
  `service.py`.
- 2026-07-01: Topic service orchestration is split from topic graph mechanics.
  `TopicsService` remains the service-facing use-case entrypoint for list,
  show, create, describe, link, unlink, rename, and delete.
  `services/topics/graph.py` owns topic existence checks, self-parent
  validation, and DAG cycle traversal; `services/topics/read_model.py` owns
  topic slug lookup through the derived index; `services/topics/workspace.py`
  owns current-repo vs explicit-`--wiki` workspace selection. Do not move graph
  traversal, read-model lookup helpers, or `SelectWorkspaceRequest` handling
  back into `service.py`.
- 2026-07-01: Wiki topic YAML handling is split by persistence path.
  `services/wiki/topic_models.py` owns parsed topic models and title defaults;
  `topic_read.py` owns forgiving PyYAML reads for index refresh;
  `topic_file.py` owns ruamel round-trip loading, mutation helpers, and atomic
  writes; and `topics.py` is only the import facade. Do not mix read/index
  tolerance, round-trip mutation mechanics, and topic models in one module.
- 2026-06-29: Source input has four local layers:
  `SourceAddress -> SourceRef -> SourceBrief -> SourceRuntime`. Git source
  runtime uses the Git CLI through a source-runtime adapter. GitHub PR/issue
  runtime uses GitHub CLI through the same port. Transcript runtime uses
  local JSONL parsing through the same port. Web URL runtime uses a local HTTP
  and HTML/text adapter through the same port. Path file/directory runtime uses
  a local filesystem adapter through the same port.
- 2026-07-01: `SourcesService` is the service-facing facade for source verbs.
  It owns resolve/discover/inspect orchestration over request models and ports,
  while `services/sources/address_resolution.py` dispatches source-address
  syntax to source-family modules. Keep runtime adapters and transcript
  discovery adapters out of address resolution.
- 2026-07-01: Source-address resolution is split by address family.
  `address_resolution.py` is the small dispatcher facade; `address_git.py`,
  `address_github.py`, `address_web.py`, `address_path.py`, and
  `address_transcript.py` own family-specific parsing and `SourceBrief`
  construction. `address_hints.py` owns prompt hints, and
  `address_numbers.py` owns shared positive-integer parsing. Do not regrow
  GitHub/web/path/transcript parsing, URL validation, hashing, or prompt hints
  inside the facade.
- 2026-07-01: Transcript source runtime is split by integration
  responsibility. `integrations/sources/transcripts/runtime.py` implements the
  `SourceRuntimeAdapter` port; `models.py` owns typed transcript line and entry
  models; `reader.py` owns JSONL file reading; `entries.py` owns known-provider
  line-to-entry normalization; `rendering.py` owns prompt-facing transcript
  text and tail truncation; `paths.py` owns `SourceRef` path resolution; and
  `errors.py` owns unavailable-runtime diagnostics.
- 2026-06-29: The local viewer's file route is a wiki-reference route:
  `/api/file?path=src/foo.py` returns pages that mention the file or folder
  reference. It does not read or preview repo file contents.
- 2026-06-29: The local viewer renders Markdown through `markdown-it-py` token
  streams. Wikilink rewriting touches text inline tokens only; inline code and
  fenced code stay source text, and labels remain escaped by the renderer.
- 2026-06-29: `serve` should borrow UseAlmanac's visual language, not its
  hosted wiki information architecture. Keep CodeAlmanac's local wiki-first
  reading model: sidebar navigation, page/topic/search/file-reference graph
  movement, and a read-only local viewer over repo-owned pages. UseAlmanac's
  colors, shell polish, account-picker styling, and dashboard chrome are valid
  reference material. Its hosted wiki page list/search flow, account routes,
  billing/settings surfaces, and hosted wording are not the target shape for
  the local product.
- 2026-06-29: Treat the current UseAlmanac wiki page and search experience as
  a non-target reference for CodeAlmanac. The desired direction is the local
  viewer already explored here: persistent sidebar, direct page reading,
  topic/file/search movement, and wiki navigation that feels like a repo-local
  knowledge browser. The earlier CodeAlmanac sidebar shell is the interaction
  target. The design layer can borrow UseAlmanac polish, but the current
  UseAlmanac page list and search treatment should not be copied. The issue is
  not the wiki content model; it is the visual/product treatment around the
  wiki reader.
- 2026-06-29: Bulletproof React is a frontend architecture reference for
  `serve`, not a mandate to add React or Next.js immediately. Apply its
  principles as the viewer grows: feature boundaries, colocated API requests,
  shared UI primitives, direct imports over broad barrels, and browser-level
  tests. A Next.js viewer is allowed only if the static package-data viewer
  becomes harder to maintain than a small built frontend.
- 2026-06-29: The `serve` frontend can use static ES modules while it remains
  a small read-only viewer. `app.js` is the entrypoint; nested modules under
  `server/assets/viewer/` own API calls, hash routes, DOM components, and
  screen renderers. This is the current Bulletproof-inspired seam. Do not add
  React, Next.js, Vite, or a frontend build step until real UI complexity makes
  static package data harder to maintain.
- 2026-06-29: Filesystem directory source runtime uses Git listing when the
  selected directory is inside a Git worktree, then falls back to the bounded
  Python/pathspec walk when Git cannot answer. This is runtime material
  selection, not a new source kind or source catalog.
- 2026-06-29: Git-listed filesystem directory runtime ranks changed and
  untracked files before unchanged files and annotates included files as
  `changed` or `unchanged` in the runtime tree. This is a prompt-material
  selection policy inside the filesystem adapter; it is not a durable
  `candidate` object.
- 2026-06-29: Clean filesystem directory runtime uses semantic diversity
  inside the adapter: after changed/untracked files, bounded selection
  interleaves directory groups and prefers role-bearing files such as
  `service.py`, `adapter.py`, `app.py`, and `main.py`. Do not add a source
  pool, durable candidate object, or Ingest branching for this.
- 2026-07-01: Filesystem source runtime is split by integration
  responsibility. `adapter.py` implements the `SourceRuntimeAdapter` port;
  `documents.py` owns text document models and charset decoding; `listing.py`
  owns directory document assembly and Git-vs-walk source selection;
  `ignore.py` owns default/configured ignore rules and `.gitignore` loading;
  `walk.py` owns Python directory walking; `git.py` owns Git listing/status
  mechanics; `rendering.py` owns prompt-facing runtime text; `paths.py` owns
  shared display/relative path helpers. Keep source selection policy local to
  the filesystem integration unless a second adapter needs the same behavior.
- 2026-07-01: GitHub source runtime is split by integration responsibility.
  `integrations/sources/github/adapter.py` implements the `SourceRuntimeAdapter`
  port; `client.py` owns `gh` process execution and typed payload retrieval;
  `models.py` owns Pydantic `gh --json` payloads; `targets.py` owns
  `SourceRef` to `gh` target arguments; `rendering.py` owns prompt-facing PR
  and issue runtime text; `errors.py` owns unavailable-runtime diagnostics.
- 2026-07-01: Web source runtime is split by integration responsibility.
  `integrations/sources/web/adapter.py` implements the `SourceRuntimeAdapter`
  port; `client.py` owns `httpx` streaming and bounded response reads;
  `models.py` owns typed fetched-response and runtime-document models;
  `documents.py` owns content-type classification, UTF-8 decoding, and
  Beautiful Soup HTML text extraction; `rendering.py` owns prompt-facing
  metadata/content rendering; and `errors.py` owns unavailable-runtime
  diagnostics.
- 2026-06-29: `manual/` is a local support package, not a public CLI surface.
  It contains bundled wiki-maintenance doctrine. `init` and `build` copy
  missing files into `<almanac-root>/manual/`, prompts tell lifecycle agents to
  read those files, and `doctor` reports package/workspace manual readiness.
- 2026-07-01: Preserve the archived terminal setup experience in Python:
  branded banner, step indicators, raw-mode selection when available,
  non-interactive `--yes`, idempotent setup, agent/default-model selection,
  instruction target installation, local automation choices, and a polished
  next-steps box. Hosted-specific wording must be removed, but the terminal UX
  quality and setup responsibilities remain first-class.
- 2026-07-01: `uninstall` should exist as the reverse of `setup`. It should
  remove setup-owned instructions and scheduler entries idempotently, with
  `--yes` and keep flags where useful.
- 2026-07-01: Setup instruction installation is split by target family behind
  the service-owned `InstructionInstaller` port. `integrations/setup/instructions.py`
  is only the `FileInstructionInstaller` facade and target dispatcher;
  `codex.py` owns Codex AGENTS block selection and cleanup; `claude.py` owns
  Claude guide/import files; `managed_blocks.py` owns marker text transforms;
  `guide.py` owns package resource loading; and `text_files.py` owns narrow
  UTF-8 file reads. Do not move provider marker surgery, package resource
  reads, or target-specific file writes back into `instructions.py`.
- 2026-07-01: Setup service orchestration is split from setup planning and
  automation-policy helpers. `services/setup/service.py` remains the
  `SetupService` facade that calls instruction and automation ports;
  `planning.py` owns `SetupPlan`, automation recommendations, and next-step
  command construction; and `automation.py` owns setup automation selection and
  `InstallAutomationRequest` conversion. Do not move duration formatting,
  automation recommendation construction, or setup automation request conversion
  back into `service.py`.
- 2026-07-01: The archive's `review` command family is not required for now.
  The archive's `migrate` command family is not needed unless a concrete
  migration path is reopened.
- 2026-06-29: `database/` owns SQLite connection setup and migration
  application. Product stores still own their SQL schemas and query semantics.
  The current `index.db` migration strategy is rebuild-on-version-change
  because the index is a derived read model from `<almanac-root>/pages/` and
  `topics.yaml`.
- 2026-07-01: Index read views are split by query family. `IndexStore` remains
  the store facade, `services/index/views.py` remains a small compatibility
  facade, and read-side SQL lives in `search_views.py`, `summary_views.py`,
  `page_views.py`, `topic_views.py`, and health read views. `health_views.py`
  is the `HealthReport` facade; `health_graph_views.py` owns
  page/topic/link/file findings, and `health_source_views.py` owns
  sources/citations findings.
- 2026-07-01: Index write-side responsibilities are split behind `IndexStore`.
  `services/index/schema.py` owns the derived `index.db` schema, migrations,
  and index connection helper; `sources.py` owns page/topic source loading and
  freshness signatures; `projection.py` owns replacement writes and stored
  source signatures. `store.py` stays the service-facing facade.
- 2026-06-29: `config` owns local user/project TOML parsing and precedence
  through `pydantic-settings`. The first config surface is intentionally
  narrow: user config at `~/.codealmanac/config.toml` and project config at
  `<almanac-root>/config.toml` can set the default lifecycle harness and sync
  quiet window. CLI flags still win over config. Do not add a public `config`
  command, environment override system, secrets system, or hosted/account
  config surface until a later agreement requires it.
- 2026-07-01: Page `sources:` are part of the wiki page model, not just prompt
  guidance. The Python index/read model should parse structured `sources:`,
  project them into SQLite, derive file refs from `sources[type=file]`, expose
  them through `show`/viewer APIs, and let health reason about missing/unused
  citation IDs. This is distinct from ingest source inputs such as paths,
  diffs, PRs, URLs, and transcripts.
- 2026-07-01: Page source address parsing prefers type-specific fields
  (`path:` for `file`, `url:` for `web`, and the documented fields for other
  types), but accepts generic `target:` as a fallback for every source type.
  This keeps the internal `PageSource.target` model aligned with prompt-shaped
  output without making downstream index/search/viewer code know alternate
  frontmatter spellings.
- 2026-07-01: Remove archive/supersede page lineage from the Python product
  model. Git history is the archive. Do not keep `archived_at`,
  `superseded_by`, `supersedes`, `--include-archive`, or `--archived` as
  product concepts unless the user reopens that decision.
- 2026-07-01: `serve` should browse all registered local wikis, matching the
  archive's multi-wiki viewer scope, while keeping the local sidebar/wiki
  reader interaction model.
- 2026-07-01: Viewer service boundaries are split by local-reader
  responsibility. `services/viewer/service.py` remains the use-case facade for
  overview/page/search/file/topic/jobs payloads; `workspace_scope.py` owns
  selected-wiki fallback, registry availability filtering, and multi-wiki
  navigation ordering; `projections.py` owns conversion from index/workspace
  models to viewer DTOs. Do not move registry filtering or DTO construction
  back into `service.py`.
- 2026-07-01: Server adapter boundaries are split by HTTP-edge
  responsibility. `server/app.py` is the FastAPI composition root only;
  `api_routes.py` owns viewer API route request construction;
  `static_routes.py` owns browser-shell route registration;
  `static_assets.py` owns package asset validation and reads; and `errors.py`
  owns product/Pydantic exception mapping. Do not move route bodies, asset
  loading, or HTTP error mapping back into `app.py`.
- 2026-06-29: The CLI edge is allowed to split by command domain as pressure
  appears. `cli/dispatch/admin.py` is an admin-command facade only;
  `setup.py` owns setup/uninstall request construction, `diagnostics.py` owns
  doctor request construction, `updates.py` owns update request construction,
  `jobs.py` owns jobs request construction, and `automation.py` owns automation
  request construction. The root dispatcher delegates to command-domain edges
  and keeps services/workflows as the product boundary.
- 2026-06-29: The SQLite index service separates projection writes from
  read-only views. `services/index/store.py` stays the service-facing facade;
  `schema.py`, `sources.py`, and `projection.py` own write-side mechanics;
  `services/index/views.py` owns read-only query SQL and row-to-Pydantic view
  construction.
- 2026-06-29: Registry cleanup is explicit. `codealmanac list` remains the
  local wiki registry surface; `list --json` exposes availability status, and
  `list --drop <selector>` / `list --drop-missing` remove entries only when the
  user asks. Read commands do not silently prune missing workspaces.
- 2026-07-01: Workspace service boundaries are split by workspace mechanic.
  `services/workspaces/service.py` remains the use-case facade for
  initialization targets, register/get/select/resolve, path validation,
  registry listing, and explicit drops. `identity.py` owns workspace names and
  ids; `selection.py` owns selector matching and path containment; `status.py`
  owns registry availability policy; `roots.py` owns configured-root
  validation and nearest-root discovery; and `store.py` owns registry JSON
  persistence. Do not move selector mechanics, id generation, or marker-based
  status checks back into `service.py`.
- 2026-06-30: An initialized Almanac root is identified by wiki markers
  (`README.md`, `topics.yaml`, or `pages/`), not by directory existence.
  Runtime artifacts such as `index.db`, WAL files, and `jobs/` are derived
  state. They must not make registry status, root discovery, `doctor`, or read
  commands treat an otherwise missing root as available.
- 2026-06-30: `docs/python-port/next-agent-brief.md` is a load-bearing
  continuation artifact. Public-contract tests discover the newest
  `docs/python-port/slice-N-*.md` file and require the brief's current-state
  section to mention that slice, so future agents do not resume from a stale
  checkpoint after compaction.
- 2026-06-30: Public beta release judgment lives in
  `docs/python-port/public-beta-gate-audit.md`. Slice 70 passed the remaining
  non-toy lifecycle dogfood pass, and slice 71 reran current-head package proof
  after the state-path change. Current remaining release work is operational:
  version, changelog, PyPI credentials, publish ownership, and the human
  publish decision.

## Product Frame

CodeAlmanac maintains a repo-owned wiki for a codebase and the project world
around that codebase. It is not a code documentation generator.

The wiki can cover code, architecture, decisions, incidents, conversations, PR
context, team conventions, deployment constraints, product strategy, and other
durable knowledge that helps future work.

The durable artifact is the repository's configured Almanac root. New installs
default to `almanac/`. Git remains the system of record for wiki changes.

The Python rewrite is a fresh codebase. Use the old CodeAlmanac implementation
and Almanac's Python engine as references for behavior and structure. Do not
share Almanac's hosted engine as a dependency in v1.

## Repository Shape

Target root:

```text
src/codealmanac/
  app.py
  core/
  database/
  services/
  workflows/
  integrations/
  server/
  cli/
  prompts/
  manual/
```

`app.py` is the composition root. It wires services and integrations through
explicit dependencies.

`core/` holds shared errors, identifiers, path/text helpers, and tiny cross-cutting
models that do not belong to one service.

`database/` owns SQLite connections and migration application.

`services/` holds product nouns:

```text
services/
  workspaces/
  wiki/
  index/
  sources/
  runs/
  harnesses/
  automation/
  config/
  diagnostics/
  updates/
  viewer/
```

`workflows/` holds multi-service product verbs:

```text
workflows/
  build/
  ingest/
  garden/
  sync/
```

`integrations/` holds concrete outside-world adapters. Organize adapters by
the service boundary they implement, not as one flat external-tool list.

```text
integrations/
  workspaces/
    git/
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
  updates/
    package.py
```

Ports live near the service that owns the product contract:

```text
services/harnesses/ports.py
services/sources/ports.py
services/automation/ports.py
```

Concrete integrations implement those ports:

```text
integrations/harnesses/codex/adapter.py
integrations/harnesses/claude/adapter.py
integrations/sources/filesystem/adapter.py
integrations/sources/github/adapter.py
integrations/sources/github/client.py
integrations/sources/github/models.py
integrations/sources/transcripts/codex.py
integrations/automation/scheduler/launchd.py
```

Do not put product decisions inside integrations. An integration translates an
outside tool into service-owned models and errors.

`cli/` owns command parsing, rendering, stdout/stderr, and exit codes. It does
not own product decisions.

`manual/` owns bundled wiki-maintenance doctrine. It is read by prompts,
copied into `<almanac-root>/manual/` by local build/init, and checked by
diagnostics. It does not add a public command.

## Python Service Symmetry

Inside a service package, use these names when needed:

```text
models.py      domain/read models
requests.py    service input contracts
ports.py       adapter protocols
store.py       CRUD/query persistence
records.py     row/model conversion
tables.py      migrations only
service.py     product verbs
```

Do not create empty files just to satisfy symmetry.

SQL belongs in `store.py`, `*_store.py`, or `tables.py`. `tables.py` defines
migrations only. Row conversion belongs in `records.py` or a store-owned helper.

Services own product verbs. Stores own CRUD/query. Integrations implement
service-owned ports. CLI and future hosted/server edges adapt.

Allowed dependency direction:

```text
cli/server
  -> app
    -> workflows
      -> services
        -> stores
        -> ports
          -> integrations
```

Do not make stores call services. Do not make integrations call services. Do
not make CLI contain product decisions.

## Service Ownership

| Service | Owns | Must Not Own |
|---|---|---|
| `workspaces` | repo root, configured Almanac root, registry, path containment, local wiki selection, repo/worktree mutation observations | page parsing, source discovery, run execution policy |
| `wiki` | markdown page truth, frontmatter, topics, wikilinks, page writes, health inputs | trigger timing, harness execution, source discovery |
| `index` | SQLite read model, FTS, mentions, backlinks, query projections | markdown truth, agent execution |
| `sources` | source observations, source refs, fingerprints, local source state | deciding when AI runs, page writes |
| `runs` | run ledger, events, outputs, lifecycle state transitions | source discovery, page parsing, provider transports |
| `harnesses` | normalized Codex/Claude task/session/event contracts and ports | run lifecycle, page writes, source catalog |
| `automation` | local trigger decisions, quiet windows, scheduler state | run internals, source parsing, provider transports |
| `config` | user/project config parsing and precedence | product workflows |
| `diagnostics` | doctor-style checks and readiness reports | mutation workflows |
| `updates` | local package update policy, installer detection, update command planning | scheduler state, hosted release management, package-manager subprocess mechanics |
| `viewer` | read-only local browser payloads, page/topic/search overview assembly, rendered markdown for the viewer | markdown source of truth, SQLite persistence, AI calls, jobs/review lifecycle |

The viewer's product shape is local wiki browsing. It may adopt UseAlmanac's
alpine visual system and shell styling, but it should not replace the existing
wiki sidebar/graph-navigation model with the hosted UseAlmanac wiki page-list
or search flow.

For frontend structure, read `docs/reference/bulletproof-react/CODEALMANAC.md`.
If `serve` remains a static asset bundle, mirror the same boundaries in plain
files: shared visual primitives, wiki-specific rendering, and API helpers
should stay distinct instead of becoming one unstructured script.

The current static module layout is:

```text
server/assets/app.js
server/assets/viewer/api.js
server/assets/viewer/routes.js
server/assets/viewer/components.js
server/assets/viewer/renderers.js
server/assets/viewer/main.js
```

## Workflows

Workflows coordinate services. They do not own durable schema unless a service
is missing.

`init` creates or refreshes the initial local wiki in the configured Almanac
root, installs the wiki manual, and runs the initial agent-backed first-build
pass. New installs default to `almanac/`. Do not split the user-facing
first-build story into `init` scaffold plus a separate `build` command.
`reindex` is the explicit read-model refresh command.

`ingest` updates the wiki from selected local material such as paths, PR refs,
diffs, commit ranges, notes, or transcript refs.

AI-backed ingest must be auditable before it becomes public CLI behavior. The
workflow requires Git change tracking, clean wiki-root state before the run,
and no non-wiki file mutation during harness execution. Dirty application
files may exist as source material if their observed state does not change
during the run. Workflows persist normalized harness events into run logs after
the harness returns and before later validation.

`sync` scans supported local transcript stores, waits for quiet sessions, maps
material back to repos with a configured Almanac root, claims a transcript
range in the sync ledger, and starts ordinary local ingest work. It does not
mean cloud sync.

`garden` maintains existing wiki structure, links, topics, stale pages, and page
quality. It may run without new source material.

## Source Model

`source` means raw material CodeAlmanac can learn from. It does not mean
"source of truth."

Authority depends on the claim:

- Code is authoritative for runtime behavior.
- Transcripts are authoritative for what was discussed.
- PRs are authoritative for review context.
- The wiki is the maintained synthesis.

Discovery answers: what material exists or changed?

Use answers: what material should this run use?

There is no durable `candidate` object in v1. Bundling is a run input selection,
not a discovered product entity.

Adding or discovering material does not imply a wiki update. Updating the wiki
is a separate `init`, `ingest`, `sync`, or `garden` workflow.

Page file/folder references belong to `wiki` and `index`, not to the source
catalog. `[[src/foo.py]]` and `[[src/foo/]]` power mentions search and health.

## CLI Contract

The v1 CLI is local-only.

```text
codealmanac init [path] [--root <repo-relative-path>]
codealmanac setup
codealmanac list
codealmanac search [query]
codealmanac show <slug>
codealmanac topics
codealmanac health
codealmanac serve
codealmanac reindex
codealmanac ingest <inputs...>
codealmanac sync
codealmanac sync status
codealmanac garden
codealmanac automation install|status|uninstall
codealmanac jobs
codealmanac jobs attach <run-id>
codealmanac jobs cancel <run-id>
codealmanac doctor
codealmanac update
codealmanac uninstall
```

Commands run inside a repo resolve the nearest configured Almanac root, like
Git resolves `.git/`.

`--root` is a setup-time option on `init`. It must be a repo-relative
directory. On first setup, omitting it means `almanac/`. Inside an existing
registered repo, omitting it means "keep the registered root." `docs/almanac/`
is the public alternate shape when a repo wants docs under `docs/`.

`codealmanac list` reads the local registry of known repos with configured
Almanac roots.

Use `--wiki <name>` to target a different registered local wiki. Do not add
`codealmanac use <wiki>` in v1; sticky selection is hosted-style state and can
confuse agents.

There is no public `capture` verb. Conversation collection is part of `sync` or
a future explicit local source workflow.

There is no public `absorb` command. The public lifecycle word is `ingest`.

`codealmanac reindex` is the explicit escape hatch for rebuilding the derived
SQLite read model. Query commands may refresh the index implicitly and silently.

`codealmanac sync` accepts local execution controls such as
`--claim-owner`, `--pending-timeout`, and `--max-failed-attempts`. Automation
uses them to make scheduled sync ownership and retry policy explicit.

Public `jobs` is required because background lifecycle execution ships. Internal
`runs` owns records, logs, event streams, outputs, and lifecycle state.
`jobs attach` streams a running job's event log. `jobs cancel` requests
cancellation for queued/running work.

CLI commands are not internal APIs. Automation, workers, tests, and server
wrappers must call the same Python services/workflows that CLI dispatch
calls. They must not shell out to `codealmanac`.

Correct shape:

```python
app.workflows.sync.run(workspace_id, request)
app.workflows.ingest.run(workspace_id, request)
app.runs.record_event(workspace_id, request)
app.viewer.page(request)
```

Incorrect shape:

```python
subprocess.run(["codealmanac", "sync"])
subprocess.run(["codealmanac", "ingest", "..."])
subprocess.run(["codealmanac", "show", "..."])
```

## Feature Map

### MVP

| Area | Features |
|---|---|
| Install/name | `codealmanac` package and command only |
| Workspace | nearest repo resolution, local registry, path containment |
| Wiki | pages, frontmatter, topics, wikilinks, file/folder refs |
| Index | SQLite read model, FTS search, mentions, backlinks, health |
| Sources | transcript/path/Git/GitHub/web input contracts, local observations, and runtime snapshots |
| Runs/jobs | durable ledger, events, outputs, foreground/background lifecycle state, attach/cancel |
| Harnesses | Codex app-server and Claude SDK/event harnesses behind normalized ports |
| Workflows | `init`, `ingest`, `sync`, `garden` |
| Automation | local scheduled sync/garden |
| CLI | thin local command surface |
| Serve | local read-only wiki viewer |
| Update | foreground local package-manager update with conservative source-install refusal |

### Explicitly Out Of Scope For V1

| Area | Decision |
|---|---|
| Hosted product | Do not build hosted shipping now |
| Hosted CLI | No `login`, `connect`, `upload`, hosted `sources`, hosted `jobs` |
| SDK | No Python SDK package |
| MCP | No MCP server |
| Compatibility aliases | No public `almanac`, `alm`, or `absorb` |
| Separate build command | No public `codealmanac build`; `init` owns first-build |
| Archive lineage | No `archived_at` / `superseded_by` page state |
| Semantic search | FTS and refs first |

## Non-Negotiables

- Public naming is `codealmanac`.
- The configured Almanac root remains the repo-owned wiki artifact. New
  installs default to `almanac/`.
- Global user state lives under `~/.codealmanac/`.
- Local v1 must not inherit hosted assumptions from merged `dev` or `origin/dev`.
- CLI edges stay thin.
- Services own product verbs.
- Stores own persistence.
- Integrations sit behind ports.
- Structured models beat loose dictionaries.
- No hidden `getattr` or dynamic attribute contracts for shaped data.
- No source-kind branches smeared across unrelated services.
- No CLI-shaped core.
- No AI-writing path outside explicit lifecycle workflows.
- SQLite remains the local read model for search, refs, topics, and health.
- File/folder mention queries use normalized paths and GLOB-safe matching.

## Open Decisions

1. Whether local `add` deserves a v1 command or should wait until source-pool
   behavior is concrete.
2. Resolved 2026-07-01: background jobs ship in v1. Public `jobs` returns as
   the inspection/control noun; internal `runs` owns records, events, outputs,
   worker state, and lifecycle transitions.
3. Resolved 2026-06-29: `serve` is restored after the core CLI/read model,
   because the Python index can now support a read-only viewer without a second
   content model.
