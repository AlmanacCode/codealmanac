# Intentional Architecture Rewrite Status

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch has 212 committed rewrite commits past `dev`. The worklog records 164 production slices so far.

The diff is broad: 450 files changed, with 22,354 insertions and 12,067 deletions.

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
- Removed the old top-level `src/wiki/` source bucket; local wiki index, query, health, topic-file, and source-frontmatter mechanics now live under `src/stores/wiki/`.
- Removed the `src/services/viewer/` service bucket; viewer-only route read models now live under `src/edges/viewer/read-model/`.
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

The latest slice removed the `src/services/viewer/` service bucket. Local viewer HTTP/static routing stays in `src/edges/viewer/`, and viewer-only API DTO assembly now lives in `src/edges/viewer/read-model/` instead of pretending to be a product service.

Verification passed: focused viewer/jobs/boundary tests with 104 tests, `npm run lint`, full `npm test` with 656 tests, `npm run build`, `node dist/codealmanac.js --version`, `node dist/codealmanac.js serve --help`, `node dist/codealmanac.js search "viewer read model" --limit 3 --json`, `node dist/codealmanac.js show almanac-serve --lead`, and a short-lived `node dist/codealmanac.js serve --port 0` startup/interrupt smoke.

## Immediate Next Work

Continue top-down subsystem passes before small leak cleanup. The major loose source buckets for jobs, init, config, wiki, and viewer read models have now been removed or assigned. Remaining candidates include service files that still know platform/provider mechanics, command files that still own workflow decisions, automation scheduling policy cleanup, and any lifecycle/job boundary duplication that remains after the big moves.

## Decision Log

There is now a standalone decision log:

- `decision-log.md` for durable rewrite decisions
- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice

Commit history remains the detailed record for individual landed boundaries.
