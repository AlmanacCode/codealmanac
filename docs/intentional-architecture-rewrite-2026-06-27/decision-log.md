# Intentional Architecture Rewrite Decision Log

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

This file records durable rewrite decisions. Per-slice details stay in `worklog.md`; the target architecture stays in `rewrite-contract.md`.

## Decisions

### Rewrite by ownership, not by phases

The rewrite proceeds as production slices on `codex/intentional-architecture-rewrite`. Each slice leaves the branch buildable, testable, and committed. There is no phase gate separate from working code.

### Use file size as a smell, not a rule

Large files are reviewed for mixed ownership. Files are split when they have multiple reasons to change, not to satisfy an arbitrary line count.

### Edges own ambient runtime facts

CLI and process edges own facts such as argv, cwd, stdout capability, terminal sinks, stdin streams, stdin TTY capability, Node runtime version, worker entrypoints, process environment, and the current process id when it becomes persisted job state. Lower layers receive those facts through explicit contracts when they need them.

CLI edges also own process lifetime signals. Viewer/server code serves HTTP and exposes `close()`, while CLI command wiring waits for SIGINT/SIGTERM through an injected stop boundary. The `almanac serve` runner and startup renderer live under `src/edges/cli/` because the command is a CLI/process edge over the viewer HTTP server, not a product service or command adapter.

Services do not own local process mechanics by default. When a service needs PID liveness or process signaling, the command or edge contract passes an explicit function so platform behavior stays at the boundary.

### Agent runtime provider registries are runtime-scoped

Claude and Codex agent runtime providers are created from an explicit runtime environment. Jobs and workers pass environment through the executor instead of importing singleton providers that close over `process.env`.

### Services own product decisions

Command adapters shape requests and render results. Services own workflow decisions, validation, coordination, and user-visible product semantics.

Command-private render modules own service-result-to-output branching. When a command receives a discriminated service result, the command should call the service and delegate the status-specific JSON/text/exit-code mapping to its render module instead of becoming a workflow decision layer.

Command adapters can choose between transport-equivalent input sources such as explicit flags and stdin. They should not normalize or classify the user-provided content when the service already owns that product rule. Review commands pass raw markdown text to wiki review services; review services clean trailing whitespace and decide whether markdown is missing.

Command adapters and renderers are CLI edge code. The top-level `src/cli.ts` file is only the stable facade that imports `src/edges/cli/run.ts`; command modules live under `src/edges/cli/commands/` because they shape argv/stdin-derived requests, call services, and render terminal output. A separate `src/cli/` directory is not an ownership category.

### Stores and integrations stay mechanical

Stores own persistence mechanics. Provider adapters, process spawning, app-server protocols, launchd, npm, and OS behavior stay in integration-shaped modules unless they are product service contracts.

### Automation task policy is service-owned

Automation task definitions are product policy, not launchd mechanics. `src/services/automation/tasks.ts` owns the sync, Garden, and update task ids, labels, default cadences, command arguments, and working-directory policy. `src/services/automation/scheduler.ts` defines the scheduler contract automation workflows depend on. `src/platform/automation/scheduler.ts` owns the launchd implementation, including PATH construction, plist/log path assembly, plist command-array normalization, job writes, bootstrap/removal, loaded-state checks, legacy capture detection, and legacy-hook cleanup.

### Diagnostic probe facts use shared contracts

Doctor probe result shapes live in `src/shared/diagnostics.ts` because they are the contract between platform probes and diagnostics services. Platform diagnostics modules own install path, SQLite binding, auth probe, automation plist, guide-file, instruction-entry, update-state, and subprocess-spawn mechanics. `src/services/diagnostics/` owns the doctor product read model: options, checks, reports, update/install/agent sections, and stable service-facing re-exports.

Doctor command registration does not wire every concrete probe directly. `src/app/diagnostics-runtime.ts` composes platform probes, update-status reads, and agent readiness into doctor runtime facts. The CLI edge owns process facts such as `process.env`, `process.version`, `process.cwd()`, `homedir()`, and stdout color capability, then passes typed facts into the command adapter.

### Setup/uninstall terminal UI belongs to the CLI edge

Setup terminal prompts, display text, setup step rendering, uninstall confirmations, and uninstall output rendering belong under `src/edges/cli/` because they are CLI interaction surfaces. Provider fix-command normalization and global-install result shaping are setup product workflow, so they live under `src/services/setup/`. CLI setup edge files should not import `src/platform/shell.ts` or `src/platform/install/global-package.ts` directly.

### Setup services depend on setup runtime contracts

Setup services own product-level normalization, state/result contracts, and error wrapping for provider fix commands and durable global installs. They do not import shell, npm, install-path, or package-manager mechanics directly. `src/platform/setup/runtime.ts` implements the service-owned setup runtime contracts by composing platform shell and global-install helpers, and `src/edges/cli/setup/` wires that concrete runtime into the setup flow.

Setup plan policy is service-owned. `src/services/setup/setup-plan.ts` owns launch defaults, prompt eligibility, and the rules that combine skip flags, explicit automation flags, agent/model flags, and interactive answers into a typed setup plan. `src/edges/cli/setup/setup-plan.ts` can collect instruction-target selections and terminal yes/no answers, but it should not own the defaults or product gates.

### Transcript file mechanics are platform, sync eligibility is service

Claude and Codex transcript-store scanning, raw transcript snapshot reads, line counting, and JSONL timestamp extraction belong under `src/platform/transcripts/`. The sync service owns quiet-window eligibility, ledger reconciliation, cursor decisions, and Absorb handoff over typed transcript candidates and snapshots.

### Lifecycle owns operation construction

Build, Absorb, and Garden operation specs are lifecycle product mechanics, so their provider-neutral construction lives under `src/services/lifecycle/operations/`. CLI commands and peer services call lifecycle workflow contracts instead of importing operation internals.

Lifecycle workflow results expose lifecycle-owned failure contracts. Agent runtime failures are normalized in `src/services/lifecycle/operation-results.ts` before command rendering reads them, so CLI output code does not depend on provider/runtime event types.

### Absorb source parsing is lifecycle, GitHub mechanics are platform

Absorb owns product input normalization under `src/services/lifecycle/absorb/`: source refs, source input contracts, context rendering, and Absorb run-start shaping. GitHub remote parsing and URL construction are external mechanics, so they live under `src/platform/github/` and return plain typed facts.

### Jobs are service runtime plus store contracts, not a top-level bucket

Job execution lifecycle, queue selection, queued-record creation, event logging, wiki-effect accounting, and viewer projections belong under `src/services/jobs/` because they are product workflow and read-model behavior. Durable job records, specs, logs, locks, and persisted schema validation belong under `src/stores/jobs/`. Detached worker process spawning belongs under `src/platform/jobs/`. CLI edges compose those two halves through `src/edges/cli/background-jobs.ts`.

Public jobs service verbs do not read job files or resolve job paths directly. They use `src/stores/jobs/index.ts` for record/log/spec mechanics, while `src/services/jobs/record-lifecycle.ts` owns record state construction/finalization and `src/services/jobs/record-view.ts` owns display-status shaping. Job projections parse log contents and derive viewer/read-model facts; they do not read arbitrary log paths directly. Job runtime code can execute, drain, and finalize jobs, but the runtime folder is not the public read API for commands, viewer read models, lifecycle callers, sync, or tests. There is no `src/services/jobs/runtime/index.ts` barrel because that file hid store, platform, and runtime ownership behind one import path.

Public jobs service files are split by verb. `src/services/jobs/read.ts` owns list/show read workflows, `log-read.ts` owns log reads and attach streaming, `cancel.ts` owns cancellation and record finalization, and `repo-root.ts` owns nearest-wiki-root resolution for public jobs verbs. The deleted `src/services/jobs/jobs.ts` file should not return as a catchall.

Job service views map from store-owned job views, not runtime-owned views. `src/services/jobs/view.ts` should describe that boundary with store terminology because durable job records and display-status shaping now live outside the job runtime folder.

### Internal workers are edges over service workflows

Hidden CLI worker entrypoints belong under `src/edges/worker/`. They can receive process facts such as cwd, pid, and environment, then call one service workflow. Queue draining remains under `src/services/jobs/runtime/` because it owns job lifecycle semantics over records, specs, locks, and agent execution.

### Wiki initialization is a service workflow over file stores

Repo/wiki initialization belongs under `src/services/wiki/` because it is the product verb that decides the repo root, wiki name, starter README content, and registry entry. Mechanical `.almanac/` directory creation and `.gitignore` writes belong under `src/stores/wiki-files/`. A top-level `src/init/` bucket is not an ownership category.

Page-file counting, absorb-log scanning, and page snapshot hashing also belong under `src/stores/wiki-files/`; services use those file facts to decide Build/setup/doctor/job behavior without owning directory reads.

### Config is store mechanics plus service verbs, not a top-level subsystem

Persisted config schema, codecs, path resolution, origin tracking, legacy migration, and atomic writes belong under `src/stores/config/`. User-facing config reads/writes belong under `src/services/config/`. Agent provider enablement belongs under `src/agent/` because environment-gated provider availability is provider policy, not config persistence.

Config commands pass raw key/value input to config services. Services own config-key catalog validation and missing-value classification for command-facing reads and mutations, then return typed result statuses for command renderers. Typed service entrypoints can remain for internal callers that already hold a `ConfigKey`.

Config service files are split by verb. `src/services/config/config-read.ts` owns list/get read workflows and origin lookup, `config-write.ts` owns set/unset validation plus raw config mutation through the config store, and `config-types.ts` owns command-facing result contracts. The deleted `src/services/config/config.ts` file should not return as a catchall.

### Wiki index/query mechanics are stores

Local wiki indexing, query SQL, health checks over indexed data, topic YAML persistence, page frontmatter rewrites, and source-frontmatter maintenance belong under `src/stores/wiki/`. Wiki services own product verbs and result contracts over those mechanics. A top-level `src/wiki/` bucket blurs product semantics with persistence/query mechanics and should stay deleted.

Wiki topic mutation services are split by mutation shape. `src/services/wiki/topic-create.ts` owns topic creation, parent promotion, and create-time parent validation. `src/services/wiki/topic-edge-mutations.ts` owns link/unlink edge workflows. `src/services/wiki/topic-page-mutations.ts` owns rename/delete workflows that coordinate topic metadata with page frontmatter rewrites. The public `src/services/wiki/topics.ts` facade can re-export all topic verbs, but the deleted `topic-graph-mutations.ts` bucket should not return.

Topic read services select product mode and shape result contracts. Raw topic page lookup SQL belongs in `src/stores/wiki/query/topics.ts`, including direct `page_topics` reads, archived-page filtering, descendant expansion, and slug ordering.

Topic rename/delete services decide which topic mutation to perform. The store owns the page-file scan and frontmatter read/rewrite mechanics through `src/stores/wiki/topics/page-rewrite.ts` and `frontmatter-rewrite.ts`.

### Viewer read models are viewer-edge code

Viewer-only API payload assembly belongs under `src/edges/viewer/read-model/`, not `src/services/viewer/`, because those contracts exist to serve the local HTTP viewer. Product services should not become a bucket for browser DTOs. Shared persistence and query mechanics remain in stores and job projections; the viewer edge composes them into route-shaped responses.

### Prefer explicit contracts over compatibility facades

Compatibility facades can remain only when callers still need a stable import. New code should depend on typed service, store, integration, or edge contracts with honest names.

### Registry reachability is store-owned

Wiki services own registry product verbs such as listing and dropping wikis. The registry store owns path reachability checks because that is filesystem state tied to persisted registry entries, not a wiki product decision.

Registry path case-sensitivity is platform-owned. The registry store still compares paths to keep add/find idempotent, but the current-OS rule for case-insensitive path comparison lives in `src/platform/path-case.ts` because it depends on `process.platform`, not registry JSON semantics.

Global viewer registry lookup goes through wiki registry services. The registry store owns mechanical checks such as whether a registered path contains `.almanac`; wiki services own the browseable, missing, and unreachable registry result contracts; the viewer edge maps those service results into viewer APIs and viewer-specific errors.

### Worker-program shape is a shared contract

The CLI edge owns discovering the current Node command and entrypoint. Lifecycle services pass that worker-program value through their workflows, and the job runtime validates that an entrypoint exists before queueing a detached worker. `src/platform/jobs/worker-process.ts` owns only the mechanics of spawning the detached process. The shared shape lives in `src/shared/worker-program.ts` so lifecycle code does not import platform worker-process mechanics and platform code does not import service workflow types.

### Update services consume runtime contracts

The update service owns update workflow policy: check latest, honor dismissals, acquire the update lock, decide whether installation should run, refresh state after success, and return a user-facing result. It talks to an injected `UpdateRuntime` contract from `src/services/update/types.ts`. `src/app/update-runtime.ts` composes installed package-version reads, npm registry checks, and package installation into that runtime. The platform update install module owns npm mechanics: command, arguments, child-process spawn options, missing-npm handling, and install-failure hints. CLI edges create the app runtime because they are the concrete composition points for command execution.

### Update state and locks are stores

`~/.almanac/update-state.json` and `.update-install.lock` are local persistence mechanics, so they live under `src/stores/update/`. Platform update modules own registry fetches, npm installation, version lookup, and notifier spawning, but they call the update store for state and lock mechanics. Update banner rendering is a CLI edge concern over a supplied installed version and service-owned announcement state; run-level CLI composition supplies that installed version from `createUpdateRuntime()`. The update lock store accepts an explicit `pid` because edges own process facts.

### Transcript contracts are shared; transcript file mechanics are platform

`src/platform/transcripts/` owns Claude/Codex transcript discovery and raw transcript file reads. `src/platform/transcripts/runtime.ts` adapts those mechanics to the service-owned `SyncTranscriptRuntime` contract. `src/shared/transcripts.ts` owns the sync-facing transcript candidate, snapshot, read-result, app, and cursor-boundary contracts. `src/services/sync/` owns source-filter parsing, quiet-window eligibility, ledger reconciliation, cursor decisions, summaries, and Absorb handoff over injected transcript runtime facts. CLI sync edges create the concrete transcript runtime because they are the command composition point.

Platform transcript discovery returns `DiscoveredTranscript` facts: app, session id, transcript path, cwd, mtime, and size. Sync services turn those facts into repo-bound `TranscriptCandidate` records by resolving the nearest `.almanac` root. The platform transcript layer must not import wiki-file stores or decide repo eligibility.

The top-level sync workflow file coordinates the sync verb; it should not be a bucket for all sync helper behavior. Source/quiet parsing, transcript-to-repo candidate shaping, sweep-summary projection, and sync Absorb prompt context each have named files under `src/services/sync/`. `src/services/sync/sync.ts` keeps config activation lookup and lifecycle Absorb handoff because those are workflow decisions of the sync product verb.

The sync sweep file coordinates candidate iteration. It may show the order of eligibility checks, repo locks, ledger reconciliation, transcript snapshot reads, cursor decisions, Absorb enqueue attempts, and summary accounting. It should not own the implementation details for candidate eligibility, internal-Almanac-session lookup, or ready-cursor-to-Absorb enqueue transitions. Those live in `candidate-eligibility.ts`, `internal-sessions.ts`, and `absorb-enqueue.ts`, respectively. Sweep-result files own summary shapes only, not prompt context text.

Setup agent-choice services are not one bucket. `agent-choice.ts` owns reading and saving the setup agent choice state over config and provider readiness. `agent-choice-types.ts` owns setup-specific contracts exposed to the CLI setup edge. `agent-choice-view.ts` owns translation from provider setup views into setup-owned view contracts. `agent-selection.ts` owns parsing and validating requested provider/model strings against enabled providers.

Codex app-server runtime has two layers. `app-server.ts` coordinates provider runtime state: request/config setup, JSON-RPC transport wiring, notification mapping, root-turn completion, turn watchdogs, and final result projection. `app-server-process.ts` owns child-process mechanics: spawning the Codex app-server, decoding stdout JSONL into protocol messages, collecting stderr for close failures, registering signal handlers, writing JSON-RPC messages to stdin, and terminating the managed child.

Codex app-server notifications are routed by notification kind. `app-notifications.ts` owns the top-level method router and generic notification categories. `app-agent-messages.ts` owns agent-message semantics: text deltas, root result capture, structured output parsing, invalid structured-output failure state, and helper-agent completion events. `app-terminal-events.ts` owns terminal event semantics: turn completion, warnings, app-server error notifications, terminal run-state success/failure mutation, and `classifyCodexFailure` calls. Tool display, usage parsing, actor tracing, root-turn detection, and process mechanics stay in their existing named files.

### Automation scheduler contracts are service-owned; launchd is platform

`src/services/automation/` owns automation product workflows: task selection, interval validation, install/status/uninstall results, legacy migration semantics, and setup cleanup verbs. It talks to an injected `AutomationScheduler` contract from `src/shared/automation-scheduler.ts`. `src/platform/automation/scheduler.ts` implements that contract with launchd/plist mechanics: default plist paths, log paths, launch PATH construction, plist writes, launchctl activation/removal/status, legacy capture detection, and XML-to-command-array normalization. CLI/setup/uninstall edges create the launchd scheduler because they are the concrete runtime composition points.

Automation install planning is not one service bucket. `src/services/automation/task-selection.ts` owns which task ids are in scope, `task-schedule.ts` owns interval and quiet-window validation, `job-planning.ts` owns scheduler job shaping over the injected scheduler contract, and `planning.ts` owns the top-level install-plan assembly. That keeps product choice, schedule parsing, command shaping, and orchestration independently named while staying inside the automation service boundary.

### Jobs execute through an injected agent runner

Foreground and queued job execution services own job records, logs, locks, wiki snapshots, finalization, and event persistence. They do not create provider registries or read `process.env`. `src/shared/agent-runtime/runner.ts` defines the injected `AgentRuntimeRunner` contract over `OperationSpec` and shared agent-runtime result/hooks because app composition, lifecycle, sync, job runtime, and worker edges all use the same provider-neutral runner shape. `src/agent/runtime/job-runner.ts` creates the concrete provider-backed runner from an explicit environment; CLI and worker edges inject that runner into lifecycle and sync workflows. Background job spawning still carries `workerEnvironment` because detached process launch is worker-process mechanics, not provider execution.

### Provider identity and runtime contracts are shared

Provider ids and static provider definitions live in `src/shared/agent-provider.ts` because config stores, job stores, lifecycle operations, readiness, and provider adapters all need the same id vocabulary. Provider-neutral runtime facts live in `src/shared/agent-runtime/`: normalized events, usage, failures, final-output specs/results, runtime hooks, and tool requests. Concrete provider execution remains under `src/agent/runtime/`, where provider adapters translate `OperationSpec` into Claude/Codex mechanics and emit the shared contracts.

Claude SDK runtime has separate provider-local owners. `src/agent/runtime/providers/claude.ts` coordinates provider status and run result projection. `src/agent/runtime/providers/claude/options.ts` maps `OperationSpec` into Claude SDK options. `src/agent/runtime/providers/claude/process.ts` owns managed child-process spawning and signal-to-abort registration because those mechanics change with Claude SDK process behavior, not with option mapping or result projection.

Claude auth probing is provider-owned. The executable lookup, `claude auth status --json` subprocess probe, legacy SDK CLI fallback, `ANTHROPIC_API_KEY` fallback, and Claude auth error text live in `src/agent/providers/claude/auth.ts`. Readiness, runtime status, and diagnostics consume that provider-owned module directly instead of sharing a generic `src/agent/auth/` bucket.

Generic provider CLI status execution is platform-owned. `src/platform/agent-cli-status.ts` owns `command -v`, child-process status command spawning, output collection, timeout/termination behavior, and injected CLI status execution. Codex/Cursor readiness and Codex runtime status choose their provider-specific commands and interpret the returned `{ ok, detail }` facts, but they do not own subprocess mechanics.

### Provider readiness uses an app-composed runtime

Provider readiness status and provider-specific model catalogs are concrete provider facts. Services can decide how those facts become setup, agents, or doctor read models, but they should not import the provider readiness registry directly. `src/shared/agent-readiness.ts` defines the provider readiness/model-choice runtime contract. `src/app/agent-readiness-runtime.ts` wires that contract to `src/agent/readiness/providers/`. CLI setup, agents, and doctor edges pass the concrete runtime into services so app composition is the visible provider wiring point.

### Agent provider views are not one bucket

Provider setup-view assembly, provider model-choice fallback behavior, provider recommendation policy, provider/model shorthand parsing, readiness normalization, static provider labels, and shared setup-view types have different reasons to change. They live as separate `src/services/agents/provider-*.ts` files instead of one provider-view file. Callers import the specific concept they need so future changes do not turn the provider setup surface back into a mixed service bucket.

Agents command services are split by user-facing verb. `src/services/agents/agents-view.ts` owns agents list/doctor read-model assembly, `agent-default.ts` owns default-provider writes and provider/model shorthand handling, `agent-model.ts` owns provider-model set/reset validation, and `agent-config-write.ts` owns the small shared config-write helper. The deleted `src/services/agents/agents.ts` file should not return as a catchall.

### Lock stores receive process facts

Job worker locks and sync locks are persistence mechanics, but process ownership and liveness are runtime facts. `src/stores/jobs/worker-lock.ts` and `src/stores/sync/lock.ts` own lock paths, owner-file persistence, stale-lock grace policy, and legacy lock cleanup. CLI and worker edges provide the current owner PID and `isLocalPidAlive` from `src/platform/process.ts` through service workflows. The neutral liveness function type lives in `src/shared/pid-liveness.ts`.

Atomic store writes use a store-owned helper. Stores can own same-directory temp-file creation and rename mechanics, but they should not read process identity to name those temp files. `src/stores/atomic-write.ts` uses UUID temp paths and cleanup-on-failure so config, update, registry, review, topic, job, and sync stores share one persistence mechanism.

### Path construction is store-owned

Machine-global paths and repo `.almanac` paths are persistence mechanics, not a root-level subsystem. `src/stores/global-paths.ts` owns the global `~/.almanac/` directory, `src/stores/wiki-registry/paths.ts` owns the registry file path, and `src/stores/wiki-files/repo-location.ts` owns repo `.almanac` path construction plus nearest-wiki-root discovery. Services can depend on these store-owned facts when deciding product behavior, but the old top-level `src/paths.ts` bucket should stay deleted.

### Cross-cutting helpers are shared contracts

Root-level helper files are not an ownership category. Cross-cutting contracts such as canonical slugification, user-facing error shape, and ANSI theme construction live under `src/shared/` because edges, services, stores, platform modules, and tests all depend on the same neutral vocabulary. Root-level source files should be entrypoints or startup guards, not reusable helper buckets.

### Operation specs are shared contracts

`OperationSpec` is the provider-neutral execution and persistence contract for Build, Absorb, and Garden jobs. Lifecycle operations build specs, job stores persist and validate specs, job runtime services execute specs, and provider adapters translate specs into concrete Claude/Codex mechanics. The contract lives in `src/shared/operation-spec.ts` so stores and provider adapters do not import lifecycle service internals just to understand persisted job files or executable run shape.

### Lifecycle workflows own operation prompt context

Command adapters shape argv/options into typed service requests and render service results. They do not compose text that becomes part of an operation prompt. Init-specific prompt context such as force and non-interactive confirmation lives in `src/services/lifecycle/workflows.ts`, next to provider selection and run-mode workflow policy, because it is lifecycle product context rather than CLI rendering.

### Absorb source resolution is an injected platform resolver

Lifecycle Absorb services own input parsing, target classification, prompt context facts, and the source-resolver contract. They do not import GitHub platform mechanics. `src/platform/sources/absorb.ts` implements the concrete resolver by using `src/platform/github/source.ts` for GitHub refs and normalizing web URLs into service-owned source facts. CLI lifecycle edges inject this resolver for `absorb` and `ingest`, while tests can inject fake resolvers directly.

### Guard boundaries with tests

Architecture-boundary tests are part of the rewrite, not decoration. When a smell is removed, add or update a test that makes the old leak harder to reintroduce.

### Keep the branch continuously releasable

Each meaningful slice should run focused verification, then broader lint/test/build/CLI smokes when risk warrants it. Commits should be pushed regularly to the rewrite branch.
