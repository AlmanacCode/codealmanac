# Intentional Architecture Rewrite Status

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch has more than 230 committed rewrite commits past `dev`. The worklog records 189 production slices so far.

The diff is broad: 485 files changed, with 24,473 insertions and 13,097 deletions.

This is no longer a small cleanup branch. It is a real ownership rewrite.

## Done

- Created the rewrite contract and branch-specific worklog.
- Moved CLI process execution and command registration into `src/edges/cli/`.
- Made CLI command files much thinner by moving product workflows into `src/services/`.
- Split wiki workflows into clearer service boundaries: search, show, health, registry, topics, review, reindex, source migration, and doctor wiki checks.
- Moved durable job persistence into explicit stores for records, specs, logs, and worker locks.
- Removed the old top-level `src/jobs/` source bucket; job runtime and projections now live under `src/services/jobs/`, durable job schemas live under `src/stores/jobs/`, and detached worker spawning lives under `src/platform/jobs/`.
- Moved job record lifecycle and display-status read-model helpers out of the job runtime folder, and put public job record/log reads behind the `src/stores/jobs/` store API.
- Removed raw log-file reads from job projections; stores own job log contents while projections parse contents into viewer/job read models.
- Moved job page snapshot file reads and page hashing into `src/stores/wiki-files/`.
- Moved registry path reachability checks into `src/stores/wiki-registry/`.
- Removed the mixed `src/services/jobs/runtime/index.ts` compatibility barrel; callers now import concrete runtime, store, platform, or record-lifecycle modules.
- Removed the old top-level `src/init/` source bucket; wiki initialization now lives under `src/services/wiki/`, and mechanical `.almanac/` file scaffolding, page-file counting, and absorb-log scanning live under `src/stores/wiki-files/`.
- Removed the old top-level `src/config/` source bucket; persisted config mechanics now live under `src/stores/config/`, service verbs live under `src/services/config/`, and provider enablement policy lives under `src/agent/`.
- Removed the old top-level `src/wiki/` source bucket; local wiki index, query, health, topic-file, and source-frontmatter mechanics now live under `src/stores/wiki/`.
- Moved topic page rewrite scanning and frontmatter read mechanics into `src/stores/wiki/topics/`.
- Removed the `src/services/viewer/` service bucket; viewer-only route read models now live under `src/edges/viewer/read-model/`.
- Moved the interactive setup and uninstall terminal UI out of `src/cli/commands/` and into `src/edges/cli/`, leaving setup services as the product workflow owner.
- Moved `almanac serve` process lifetime and startup rendering into `src/edges/cli/`, leaving viewer server code as the HTTP/static route owner.
- Moved the hidden internal job worker entrypoint into `src/edges/worker/`; queued job draining remains a job service runtime workflow.
- Moved sync ledger and lock persistence into explicit stores.
- Moved local Claude/Codex transcript discovery, transcript snapshot reads, and timestamp boundary parsing into `src/platform/transcripts/` and removed the old top-level `src/sync/` source bucket.
- Moved sync-facing transcript contracts and cursor boundary calculation into `src/shared/transcripts.ts`, leaving platform transcript modules focused on discovery and file reads.
- Moved lifecycle operation construction and Absorb input/source handling into `src/services/lifecycle/` and removed the old top-level `src/operations/` and `src/absorb/` source buckets.
- Normalized lifecycle operation failures into lifecycle-owned result contracts before command rendering sees them.
- Moved worker-program shape into `src/shared/worker-program.ts` so lifecycle services no longer import platform worker-process mechanics.
- Reshaped update install injection so update services accept typed install results while platform update modules own npm child-process mechanics.
- Moved update state and install-lock persistence into `src/stores/update/`; platform update modules now own registry/npm/version behavior, not JSON state-file mechanics.
- Moved update registry/version/install mechanics behind a service-owned `UpdateRuntime` contract, with the real runtime composed in the CLI edge.
- Moved GitHub source resolution mechanics into `src/platform/github/`.
- Moved provider execution runtime into `src/agent/runtime/`, especially Claude and Codex app-server mechanics, and made provider runtime environment flow through explicit job/registry contracts.
- Moved setup, diagnostics, update, automation, jobs, sync, lifecycle, config, and agents workflows behind service-owned contracts.
- Moved diagnostic probe result contracts into `src/platform/diagnostics/types.ts`, while `src/services/diagnostics/` now owns only doctor read models and service-facing re-exports.
- Moved setup provider fix-command normalization/execution into `src/services/setup/provider-fix-command.ts`, so setup TUI files no longer import platform shell mechanics.
- Moved setup global-install state/execution into `src/services/setup/global-install.ts`, so setup TUI files no longer import platform package-manager mechanics.
- Split the automation task catalog out of platform launchd mechanics: task meaning/defaults live under `src/services/automation/tasks.ts`, while plist/log paths live under `src/platform/automation/paths.ts`.
- Moved automation scheduler mechanics behind `src/services/automation/scheduler.ts`, with launchd implementation in `src/platform/automation/scheduler.ts`; automation services no longer import `src/platform/automation/`.
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

The latest slice moved update registry/version/install mechanics behind a service-owned `UpdateRuntime` contract. `src/services/update/update.ts` now owns update policy over an injected runtime, while `src/platform/update/runtime.ts` composes package-version reads, npm registry checks, and `npm i -g codealmanac@latest` installation.

Verification passed so far: `npx tsc --noEmit --pretty false` and focused update/boundary tests.

## Immediate Next Work

Continue top-down subsystem passes before small leak cleanup. The major loose source buckets for jobs, init, config, wiki, viewer read models, worker entrypoints, serve process lifetime, setup/uninstall terminal UI, wiki file mechanics, and automation scheduler mechanics have now been removed or assigned. Remaining candidates include service files that still know platform/provider mechanics, command files that still own workflow decisions, and any lifecycle/job boundary duplication that remains after the big moves.

## Decision Log

There is now a standalone decision log:

- `decision-log.md` for durable rewrite decisions
- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice

Commit history remains the detailed record for individual landed boundaries.
