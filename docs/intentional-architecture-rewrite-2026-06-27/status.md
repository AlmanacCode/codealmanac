# Intentional Architecture Rewrite Status

Date: 2026-06-28
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch has more than 280 committed rewrite commits past `dev`. The worklog records 277 production slices so far.

The diff is broad: more than 490 files changed, with tens of thousands of lines reshaped.

This is no longer a small cleanup branch. It is a real ownership rewrite.

## Done

- Created the rewrite contract and branch-specific worklog.
- Added explicit CLI app composition under `src/app/cli-runtime.ts` for concrete lifecycle and sync runtime wiring.
- Added explicit automation app composition under `src/app/automation-runtime.ts` for launchd scheduler wiring.
- Moved bundled operation prompt file mechanics into `src/platform/prompts.ts`, with lifecycle services receiving an injected prompt loader.
- Moved setup instruction file mechanics into `src/platform/setup/instructions.ts`, with setup services receiving an injected setup instruction runtime.
- Moved CLI process execution and command registration into `src/edges/cli/`.
- Split query command registration into per-command edge files for serve, search, show, health, and list.
- Split lifecycle run command registration into per-operation edge files for init, absorb/ingest, and Garden.
- Split setup-family command registration into per-command edge files for setup, doctor, update, and uninstall.
- Split topic command registration into read, create, graph-edge, and page-mutation edge files.
- Split wiki topic graph mutations into create-topic and edge-mutation service files.
- Split review command registration into add, read, decision, and markdown-input edge files.
- Split automation command registration into install, uninstall, status, and task-input edge files.
- Split jobs command registration into read, log/attach, and cancel edge files.
- Split sync command registration into run, status, and runtime-input edge files.
- Made CLI command files much thinner by moving product workflows into `src/services/`.
- Moved remaining command adapters, renderers, and command output helpers from the old top-level `src/cli/` directory into `src/edges/cli/commands/`.
- Split wiki workflows into clearer service boundaries: search, show, health, registry, topics, review, reindex, source migration, and doctor wiki checks.
- Moved topic-read page lookup SQL and indexed-topic existence SQL into the wiki query store so topic services no longer own query mechanics.
- Moved viewer overview count SQL and `topics.yaml` existence checks into stores, so viewer read models compose route payloads over store-owned facts.
- Moved durable job persistence into explicit stores for records, specs, logs, and worker locks.
- Removed the old top-level `src/jobs/` source bucket; job runtime and projections now live under `src/services/jobs/`, durable job schemas live under `src/stores/jobs/`, and detached worker spawning lives under `src/platform/jobs/`.
- Split the old public `src/services/jobs/jobs.ts` bucket into owned read, log, cancel, and repo-root service files.
- Moved job record lifecycle and display-status read-model helpers out of the job runtime folder, and put public job record/log reads behind the `src/stores/jobs/` store API.
- Moved job display/read-model view contracts into job services so job stores describe durable records only.
- Removed raw log-file reads from job projections; stores own job log contents while projections parse contents into viewer/job read models.
- Moved detached job-worker process startup behind an edge-composed background starter; job services now queue records/specs/logs and consume an injected worker starter.
- Moved job page snapshot file reads and page hashing into `src/stores/wiki-files/`.
- Moved repo `.almanac` path construction and nearest-wiki-root discovery into `src/stores/wiki-files/repo-location.ts`.
- Moved registry path reachability checks into `src/stores/wiki-registry/`.
- Moved global viewer registry browseability decisions into wiki registry services over store-owned wiki-root checks.
- Moved registry path case-sensitivity detection into `src/platform/path-case.ts`.
- Moved global state path and registry path construction into `src/stores/global-paths.ts` and `src/stores/wiki-registry/paths.ts`, deleting the old top-level `src/paths.ts`.
- Moved cross-cutting slug, user-facing error, and ANSI theme helper contracts into `src/shared/`, deleting the old root-level helper files.
- Removed the mixed `src/services/jobs/runtime/index.ts` compatibility barrel; callers now import concrete runtime, store, platform, or record-lifecycle modules.
- Removed the old top-level `src/init/` source bucket; wiki initialization now lives under `src/services/wiki/`, and mechanical `.almanac/` file scaffolding, page-file counting, and absorb-log scanning live under `src/stores/wiki-files/`.
- Removed the old top-level `src/config/` source bucket; persisted config mechanics now live under `src/stores/config/`, service verbs live under `src/services/config/`, and provider enablement policy lives under `src/shared/`.
- Removed the old top-level `src/wiki/` source bucket; local wiki index, query, health, topic-file, and source-frontmatter mechanics now live under `src/stores/wiki/`.
- Moved topic page rewrite scanning and frontmatter read mechanics into `src/stores/wiki/topics/`.
- Removed the `src/services/viewer/` service bucket; viewer-only route read models now live under `src/edges/viewer/read-model/`.
- Moved the interactive setup and uninstall terminal UI out of `src/cli/commands/` and into `src/edges/cli/`, leaving setup services as the product workflow owner.
- Moved `almanac serve` process lifetime and startup rendering into `src/edges/cli/`, leaving viewer server code as the HTTP/static route owner.
- Moved the hidden internal job worker entrypoint into `src/edges/worker/`; queued job draining remains a job service runtime workflow.
- Moved sync ledger and lock persistence into explicit stores.
- Moved local Claude/Codex transcript discovery, transcript snapshot reads, and timestamp boundary parsing into `src/platform/transcripts/` and removed the old top-level `src/sync/` source bucket.
- Moved sync-facing transcript contracts and cursor boundary calculation into `src/shared/transcripts.ts`, leaving platform transcript modules focused on discovery and file reads.
- Moved the sync transcript runtime port into `src/shared/transcripts.ts`, so platform transcript runtime no longer imports sync service types.
- Moved transcript-to-repo enrichment into sync services, so platform transcript discovery returns raw discovered transcript facts without importing wiki-file stores.
- Moved concrete transcript discovery/snapshot composition behind an injected sync transcript runtime contract, with `src/platform/transcripts/runtime.ts` wired by the CLI sync edge.
- Moved sync's internal-Almanac-session lookup behind a jobs-service provider-session helper, so sync no longer reads job record storage shape directly.
- Split sync workflow helpers into owned files for input parsing, transcript candidate shaping, summary projection, and Absorb context rendering.
- Split sync sweep helpers into owned files for candidate eligibility, internal-session detection, and Absorb enqueue/ledger transitions.
- Moved lifecycle operation construction and Absorb input/source handling into `src/services/lifecycle/` and removed the old top-level `src/operations/` and `src/absorb/` source buckets.
- Normalized lifecycle operation failures into lifecycle-owned result contracts before command rendering sees them.
- Moved init prompt context construction out of the operation command adapter and into lifecycle workflows, so command code only shapes flags into service requests and renders service results.
- Split lifecycle workflow contracts out of `src/services/lifecycle/workflows.ts` into `src/services/lifecycle/workflow-types.ts`, so the workflow implementation reads as product policy instead of a mixed API/type bucket.
- Moved raw config-key validation for config get/set/unset into config services, so config command code only passes raw input and renders service result statuses.
- Split the old `src/services/config/config.ts` bucket into config read, write, and type files so config service verbs have separate owners.
- Moved review markdown cleanup and missing-markdown classification fully into wiki review services, so review commands only choose the raw input source.
- Moved worker-program shape into `src/shared/worker-program.ts` so lifecycle services no longer import platform worker-process mechanics.
- Reshaped update install injection so update services accept typed install results while platform update modules own npm child-process mechanics.
- Moved update state and install-lock persistence into `src/stores/update/`; platform update modules now own registry/npm/version behavior, not JSON state-file mechanics.
- Moved update registry/version/install mechanics behind a service-owned `UpdateRuntime` contract, with the real runtime composed in the CLI edge.
- Moved update check/cache workflow into `src/services/update/check.ts`, registry fetch mechanics into `src/platform/update/check.ts`, and concrete runtime composition into `src/app/update-runtime.ts`.
- Moved update notifier/banner eligibility into `src/services/update/notifier.ts`, CLI banner rendering into `src/edges/cli/update-announcement.ts`, and detached update-check process spawning into `src/platform/update/notifier-worker.ts`.
- Removed the update banner edge's direct platform version read; run-level CLI composition now supplies the installed version from `createUpdateRuntime()`.
- Moved update diagnostic status reads into `src/services/diagnostics/update-status.ts`, leaving platform diagnostics for external/auth/install/automation probes.
- Moved GitHub source resolution mechanics into `src/platform/github/`.
- Moved Absorb source resolver composition into `src/platform/sources/absorb.ts` and the CLI edge, so lifecycle Absorb services no longer import platform GitHub mechanics.
- Moved Absorb source-ref and resolved-source contracts into `src/shared/absorb-sources.ts`, so platform source resolvers no longer import lifecycle service-internal Absorb files.
- Moved provider execution runtime into `src/agent/runtime/`, especially Claude and Codex app-server mechanics, and made provider runtime environment flow through explicit job/registry contracts.
- Split Claude SDK process mechanics out of the SDK option mapper and runtime coordinator.
- Moved Claude auth probing from the generic `src/agent/auth/` bucket into provider-owned `src/agent/providers/claude/auth.ts`.
- Moved generic provider CLI status process mechanics into `src/platform/agent-cli-status.ts`, so Codex/Cursor readiness and Codex runtime status share one platform-owned command runner.
- Split Codex app-server process mechanics out of the JSON-RPC runtime coordinator.
- Split Codex app-server agent-message handling out of the generic notification router.
- Split Codex app-server terminal event handling out of the generic notification router.
- Moved setup, diagnostics, update, automation, jobs, sync, lifecycle, config, and agents workflows behind service-owned contracts.
- Moved diagnostic probe mechanics into `src/platform/diagnostics/`, while `src/services/diagnostics/` now owns only doctor read models and service-facing re-exports.
- Moved diagnostic fact contracts into `src/shared/diagnostics.ts`, so platform probes and diagnostics services meet through a neutral contract instead of a service-to-platform type import.
- Moved doctor diagnostic runtime composition into `src/app/diagnostics-runtime.ts`, so doctor command registration owns process facts but not concrete probe wiring.
- Moved Claude auth diagnostic wiring into `src/app/diagnostic-auth.ts`, so platform diagnostics no longer import provider auth modules.
- Moved setup provider fix-command normalization/execution into `src/services/setup/provider-fix-command.ts`, so setup TUI files no longer import platform shell mechanics.
- Moved setup global-install state/execution into `src/services/setup/global-install.ts`, so setup TUI files no longer import platform package-manager mechanics.
- Moved setup runtime ports into `src/shared/setup-runtime.ts`, so platform setup mechanics no longer import setup service files for contract types.
- Moved setup shell/global-install mechanics behind `src/platform/setup/runtime.ts`, so setup services own contracts/results while the CLI setup edge owns concrete runtime composition.
- Split setup agent-choice services into state persistence, setup-specific contracts, provider-view mapping, and selection validation files.
- Moved setup plan defaults and gate-selection policy into `src/services/setup/setup-plan.ts`, leaving the CLI setup edge to collect terminal answers and render steps.
- Split the automation task catalog out of platform launchd mechanics: task meaning/defaults live under `src/services/automation/tasks.ts`, while plist/log paths live under `src/platform/automation/paths.ts`.
- Moved the automation scheduler port into `src/shared/automation-scheduler.ts`, so launchd platform mechanics no longer import automation services.
- Moved automation scheduler mechanics behind the shared scheduler port, with launchd implementation in `src/platform/automation/scheduler.ts`; automation services no longer import `src/platform/automation/`.
- Split automation install planning into task selection, task schedule validation, scheduler-job construction, and top-level install-plan orchestration files.
- Moved concrete agent runtime provider registry creation out of job runtime services; CLI and worker edges now inject an `AgentRuntimeRunner`, while `src/agent/runtime/job-runner.ts` owns provider-registry composition.
- Moved the provider-neutral agent runner contract into `src/shared/agent-runtime/runner.ts`, deleting the old job-runtime-private contract file.
- Moved provider identity and provider-neutral runtime event/final-output/tool contracts into `src/shared/`, so services and stores no longer import provider runtime contract files from `src/agent/runtime/`.
- Moved provider enablement policy into `src/shared/agent-provider-enablement.ts` and provider setup/readiness view construction into `src/services/agents/`, leaving `src/agent/readiness/providers/` focused on provider status probing.
- Moved provider readiness/model-choice contracts into `src/shared/agent-readiness.ts` and concrete readiness wiring into `src/app/agent-readiness-runtime.ts`, so provider setup views consume an injected runtime instead of importing provider internals.
- Split the former provider setup-view bucket into provider setup-view, model-choice, recommendation, selection, readiness, catalog, and type files under `src/services/agents/`.
- Split the old `src/services/agents/agents.ts` bucket into owned service files for agents read views, default-provider writes, provider-model writes, and config-write mechanics.
- Removed setup's duplicate spawned-process contract; setup now aliases the shared agent readiness spawn contract.
- Removed the stale wiki indexer `total` compatibility alias; `pagesIndexed` is now the single result contract name through indexer, reindex service, CLI adapter, and renderer.
- Split the monolithic architecture boundary test file into subsystem-owned boundary test files, so the guardrails now follow the same ownership map as `src/`.
- Moved the SQLite ABI startup guard into `src/edges/cli/`, leaving root `src/` with only the intentional stable CLI facade.
- Removed platform path-case mechanics from registry stores and wiki services; CLI/app composition now injects current-platform registry path equality.
- Moved wiki command target resolution into `src/services/wiki/wiki-root.ts`, deleting the old indexer-store resolver path.
- Moved cross-wiki health reachability classification into wiki health services, leaving wiki health stores to report indexed cross-wiki link facts.
- Moved `JobView` and stale display-status contracts out of job stores and into `src/services/jobs/record-view.ts`.
- Moved lifecycle operation starter result contracts off concrete job runtime/store result types.
- Moved operation-output contracts into `src/shared/operation-output.ts` so lifecycle, jobs services, and job stores share one neutral type.
- Split lifecycle workflows into owner-named init, Absorb, Garden, and provider-resolution files under `src/services/lifecycle/workflows/`, deleting the old catchall workflow bucket.
- Moved the path-equality runtime contract into `src/shared/path-equality.ts`, so services, app composition, and registry stores no longer import a neutral contract from registry persistence.
- Split lifecycle CLI operation adapters into owner-named init, Absorb, Garden, and render files under `src/edges/cli/commands/operations/`, deleting the old command catchall and render compatibility paths.
- Moved setup provider-fix runtime wiring to setup command registration, so setup agent-choice UI consumes an explicit runner instead of importing platform runtime fallback mechanics.
- Split automation CLI command adapters into install, uninstall, status, and render owner files, deleting the old automation command/render catchalls.
- Split jobs CLI command adapters into read, logs, cancel, render, and format owner files, deleting the old jobs command/render/format catchalls.
- Split wiki review CLI command adapters into add, read, decision, markdown, and render owner files, deleting the old review command/render catchalls.
- Split migrate CLI command adapters into legacy-sources, automation, and render owner files, deleting the old migrate command/render catchalls.
- Split agents CLI command adapters into read, default-provider, model, and render owner files, deleting the old agents command/render catchalls and unused alias exports.
- Split config CLI command adapters into read, write, and render owner files, deleting the old config command/render catchalls.
- Split tag/untag CLI command adapters into apply, remove, and render owner files, deleting the old tag command/render catchalls.
- Split sync CLI command adapters into run, status, options, and render owner files, deleting the old sync command/render catchalls.
- Moved the provider-neutral operation spec contract into `src/shared/operation-spec.ts`, so lifecycle services build specs, job stores persist them, and provider adapters execute them without stores or providers importing lifecycle service internals.
- Moved worker-lock and sync-lock process ownership/liveness facts out of stores; stores now persist lock files over injected owner PID and liveness contracts while CLI/worker edges provide platform process probes.
- Moved repeated store atomic-write temp-file mechanics into `src/stores/atomic-write.ts`, removing process-PID temp names from job and sync stores.
- Split most command rendering into command-private render files.
- Added architecture-boundary tests to stop old dependency leaks from returning.
- Ran repeated lint, focused tests, full test suites, builds, CLI smokes, and review passes across the branch.

## Remaining

- Continue removing ambient runtime state from non-edge layers.
- Continue checking for service files that still know too much about platform, provider, or CLI mechanics.
- Continue checking for command files that still own workflow decisions instead of request shaping and rendering.
- Review large files that remain large because of mixed ownership, not because the domain is naturally dense.
- Continue subsystem-level passes before small leak cleanup.
- Run another broad review pass over the full branch before calling the rewrite merge-ready.

## Latest Checkpoint

The latest slice split sync CLI command adapters by run/status ownership. `sync/run.ts` owns live sync request shaping, `sync/status.ts` owns status request shaping, `sync/options.ts` owns shared command-to-workflow option mapping, and `sync/render.ts` owns command output; the old `src/edges/cli/commands/sync.ts` and `sync-render.ts` catchalls are gone.

Verification passed:

- `npm run lint`
- `npx vitest run test/architecture-jobs-sync-boundaries.test.ts test/architecture-lifecycle-provider-boundaries.test.ts test/sync.test.ts`
- `npx vitest run test/architecture-*-boundaries.test.ts`
- `git diff --check`
- `npm test`
- `npm run build`
- `node dist/launcher.js --version`
- `node dist/launcher.js doctor --help`
- `node dist/launcher.js agents --help`
- `node dist/launcher.js jobs --help`
- `node dist/launcher.js doctor --json --install-only`
- `node dist/launcher.js reindex`

Previous full-slice verification also passed:

- `npm run lint`
- `npx vitest run test/update-announce.test.ts test/update.test.ts test/cli.test.ts test/architecture-*-boundaries.test.ts`
- `git diff --check`
- `npm test`
- `npm run build`
- `node dist/launcher.js doctor --help`
- `node dist/launcher.js agents --help`
- `node dist/launcher.js jobs --help`

## Immediate Next Work

Continue top-down subsystem passes before small leak cleanup. The major loose source buckets for jobs, init, config, wiki, viewer read models, worker entrypoints, serve process lifetime, setup/uninstall terminal UI, wiki file mechanics, automation scheduler mechanics, automation scheduler app composition, automation command adapter ownership, jobs command adapter ownership, review command adapter ownership, migrate command adapter ownership, agents command adapter ownership, config command adapter ownership, tag command adapter ownership, sync command adapter ownership, setup instruction runtime composition, provider setup-view ownership, setup provider-fix runtime composition, job provider-runner composition, job-worker process spawning, Absorb source resolver composition, Absorb source contract ownership, prompt loader mechanics, update runtime composition, update notifier ownership, setup runtime composition, sync transcript runtime composition, sync-to-job session lookup, CLI app composition, diagnostic fact contracts, provider-neutral agent runtime contracts, lock process-liveness contracts, operation-spec type ownership, operation-output type ownership, path-equality contract ownership, init prompt-context ownership, config command validation ownership, store atomic-write ownership, review command markdown ownership, lifecycle workflow type ownership, lifecycle workflow verb ownership, lifecycle command adapter verb ownership, path construction ownership, shared helper-contract ownership, wiki command target resolution, cross-wiki health coordination, job service view ownership, and lifecycle/job starter result ownership have now been removed or assigned. Remaining candidates include command files that still own workflow decisions, remaining platform modules that read config/store state directly, lifecycle/job boundary duplication that remains after the big moves, and large files whose size may still reflect mixed ownership.

## Decision Log

There is now a standalone decision log:

- `decision-log.md` for durable rewrite decisions
- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice

Commit history remains the detailed record for individual landed boundaries.
