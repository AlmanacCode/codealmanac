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

### Stores and integrations stay mechanical

Stores own persistence mechanics. Provider adapters, process spawning, app-server protocols, launchd, npm, and OS behavior stay in integration-shaped modules unless they are product service contracts.

### Automation task policy is service-owned

Automation task definitions are product policy, not launchd mechanics. `src/services/automation/tasks.ts` owns the sync, Garden, and update task ids, labels, default cadences, command arguments, and working-directory policy. `src/platform/automation/job-plan.ts` owns concrete scheduler job construction, including PATH, plist path, and log path assembly. `src/platform/automation/paths.ts` owns launchd plist/log path construction, and `src/platform/automation/launchd.ts` owns plist rendering, bootstrap/removal, and loaded-state checks.

### Diagnostic probe facts are platform-owned

Doctor probe result contracts that describe local machine facts belong under `src/platform/diagnostics/types.ts`. Platform probes own install path, SQLite binding, auth probe, automation plist, guide-file, instruction-entry, update-state, and subprocess-spawn facts. `src/services/diagnostics/` owns the doctor product read model: options, checks, reports, update/install/agent sections, and stable service-facing re-exports.

### Setup TUI owns interaction, setup services own install workflows

Setup command files may own terminal prompts and display text. Provider fix-command normalization/execution and global-install state/execution are setup product workflow, so they live under `src/services/setup/` and call platform shell or package-manager mechanics there. CLI setup files should not import `src/platform/shell.ts` or `src/platform/install/global-package.ts` directly.

### Transcript file mechanics are platform, sync eligibility is service

Claude and Codex transcript-store scanning, raw transcript snapshot reads, line counting, and JSONL timestamp extraction belong under `src/platform/transcripts/`. The sync service owns quiet-window eligibility, ledger reconciliation, cursor decisions, and Absorb handoff over typed transcript candidates and snapshots.

### Lifecycle owns operation construction

Build, Absorb, and Garden operation specs are lifecycle product mechanics, so their provider-neutral construction lives under `src/services/lifecycle/operations/`. CLI commands and peer services call lifecycle workflow contracts instead of importing operation internals.

### Absorb source parsing is lifecycle, GitHub mechanics are platform

Absorb owns product input normalization under `src/services/lifecycle/absorb/`: source refs, source input contracts, context rendering, and Absorb run-start shaping. GitHub remote parsing and URL construction are external mechanics, so they live under `src/platform/github/` and return plain typed facts.

### Jobs are service runtime plus store contracts, not a top-level bucket

Job execution lifecycle, queue selection, event logging, wiki-effect accounting, and viewer projections belong under `src/services/jobs/` because they are product workflow and read-model behavior. Durable job records, specs, logs, locks, and persisted schema validation belong under `src/stores/jobs/`. Detached worker process spawning belongs under `src/platform/jobs/`.

Public jobs service verbs do not read job files or resolve job paths directly. They use `src/stores/jobs/index.ts` for record/log/spec mechanics, while `src/services/jobs/record-lifecycle.ts` owns record state construction/finalization and `src/services/jobs/record-view.ts` owns display-status shaping. Job projections parse log contents and derive viewer/read-model facts; they do not read arbitrary log paths directly. Job runtime code can execute, drain, and finalize jobs, but the runtime folder is not the public read API for commands, viewer read models, lifecycle callers, sync, or tests. There is no `src/services/jobs/runtime/index.ts` barrel because that file hid store, platform, and runtime ownership behind one import path.

### Internal workers are edges over service workflows

Hidden CLI worker entrypoints belong under `src/edges/worker/`. They can receive process facts such as cwd, pid, and environment, then call one service workflow. Queue draining remains under `src/services/jobs/runtime/` because it owns job lifecycle semantics over records, specs, locks, and agent execution.

### Wiki initialization is a service workflow over file stores

Repo/wiki initialization belongs under `src/services/wiki/` because it is the product verb that decides the repo root, wiki name, starter README content, and registry entry. Mechanical `.almanac/` directory creation and `.gitignore` writes belong under `src/stores/wiki-files/`. A top-level `src/init/` bucket is not an ownership category.

### Config is store mechanics plus service verbs, not a top-level subsystem

Persisted config schema, codecs, path resolution, origin tracking, legacy migration, and atomic writes belong under `src/stores/config/`. User-facing config reads/writes belong under `src/services/config/`. Agent provider enablement belongs under `src/agent/` because environment-gated provider availability is provider policy, not config persistence.

### Wiki index/query mechanics are stores

Local wiki indexing, query SQL, health checks over indexed data, topic YAML persistence, page frontmatter rewrites, and source-frontmatter maintenance belong under `src/stores/wiki/`. Wiki services own product verbs and result contracts over those mechanics. A top-level `src/wiki/` bucket blurs product semantics with persistence/query mechanics and should stay deleted.

### Viewer read models are viewer-edge code

Viewer-only API payload assembly belongs under `src/edges/viewer/read-model/`, not `src/services/viewer/`, because those contracts exist to serve the local HTTP viewer. Product services should not become a bucket for browser DTOs. Shared persistence and query mechanics remain in stores and job projections; the viewer edge composes them into route-shaped responses.

### Prefer explicit contracts over compatibility facades

Compatibility facades can remain only when callers still need a stable import. New code should depend on typed service, store, integration, or edge contracts with honest names.

### Guard boundaries with tests

Architecture-boundary tests are part of the rewrite, not decoration. When a smell is removed, add or update a test that makes the old leak harder to reintroduce.

### Keep the branch continuously releasable

Each meaningful slice should run focused verification, then broader lint/test/build/CLI smokes when risk warrants it. Commits should be pushed regularly to the rewrite branch.
