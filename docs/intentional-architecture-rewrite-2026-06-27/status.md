# Intentional Architecture Rewrite Status

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch has 210 committed rewrite commits past `dev`. The worklog records 162 production slices so far.

The diff is broad: 423 files changed, with 21,905 insertions and 11,651 deletions.

This is no longer a small cleanup branch. It is a real ownership rewrite.

## Done

- Created the rewrite contract and branch-specific worklog.
- Moved CLI process execution and command registration into `src/edges/cli/`.
- Made CLI command files much thinner by moving product workflows into `src/services/`.
- Split wiki workflows into clearer service boundaries: search, show, health, registry, topics, review, reindex, source migration, and doctor wiki checks.
- Moved durable job persistence into explicit stores for records, specs, logs, and worker locks.
- Removed the old top-level `src/jobs/` source bucket; job runtime and projections now live under `src/services/jobs/`, durable job schemas live under `src/stores/jobs/`, and detached worker spawning lives under `src/platform/jobs/`.
- Removed the old top-level `src/init/` source bucket; wiki initialization now lives under `src/services/wiki/`, and mechanical `.almanac/` file scaffolding lives under `src/stores/wiki-files/`.
- Removed the old top-level `src/config/` source bucket; persisted config mechanics now live under `src/stores/config/`, service verbs live under `src/services/config/`, and provider enablement policy lives under `src/agent/`.
- Moved sync ledger and lock persistence into explicit stores.
- Moved local Claude/Codex transcript discovery into `src/platform/transcripts/` and removed the old top-level `src/sync/` source bucket.
- Moved lifecycle operation construction and Absorb input/source handling into `src/services/lifecycle/` and removed the old top-level `src/operations/` and `src/absorb/` source buckets.
- Moved GitHub source resolution mechanics into `src/platform/github/`.
- Moved provider execution runtime into `src/agent/runtime/`, especially Claude and Codex app-server mechanics, and made provider runtime environment flow through explicit job/registry contracts.
- Moved setup, diagnostics, update, automation, jobs, sync, lifecycle, config, and agents workflows behind service-owned contracts.
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

The latest slice removed the old top-level `src/config/` source bucket. Persisted config schema, codecs, raw-object editing, origin tracking, path resolution, legacy migration, and atomic writes now live under `src/stores/config/`; provider enablement policy now lives under `src/agent/provider-enablement.ts`.

Verification passed: focused config/provider/setup/update/sync/doctor/boundary tests with 179 tests, `npm run lint`, full `npm test` with 656 tests, `npm run build`, `node dist/codealmanac.js --version`, `node dist/codealmanac.js config list --json`, `node dist/codealmanac.js config get agent.default --json`, and `node dist/codealmanac.js agents --help`.

## Immediate Next Work

Continue top-down subsystem passes before small leak cleanup. The indexer warning, provider enablement, config store/service split, autoregistration registry-matching, agent runtime boundary, sync transcript-discovery boundary, lifecycle operation/absorb boundary, GitHub source platform boundary, job runtime/store/platform boundary, wiki initialization/store split, job-record PID paths, serve interrupt handling, setup/uninstall terminal sinks and input streams, setup guide package lookup, setup next-step wiki-state ownership, automation disabled-plist existence probing, doctor Node runtime version, doctor auth/automation/instruction/update probing, doctor index-db probing, doctor option cleanup, jobs PID liveness/signaling paths, lifecycle init request context, review command result rendering, and viewer edge/read-model split are now explicit. Remaining candidates include command workflow decisions, service taxonomy, automation scheduling policy cleanup, and any remaining lifecycle/job boundary duplication.

## Decision Log

There is now a standalone decision log:

- `decision-log.md` for durable rewrite decisions
- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice

Commit history remains the detailed record for individual landed boundaries.
