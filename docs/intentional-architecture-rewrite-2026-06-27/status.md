# Intentional Architecture Rewrite Status

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch has 202 committed rewrite commits past `dev`. The worklog records 156 production slices so far.

The diff is broad: 359 files changed, with 20,788 insertions and 10,713 deletions.

This is no longer a small cleanup branch. It is a real ownership rewrite.

## Done

- Created the rewrite contract and branch-specific worklog.
- Moved CLI process execution and command registration into `src/edges/cli/`.
- Made CLI command files much thinner by moving product workflows into `src/services/`.
- Split wiki workflows into clearer service boundaries: search, show, health, registry, topics, review, reindex, source migration, and doctor wiki checks.
- Moved durable job persistence into explicit stores for records, specs, logs, and worker locks.
- Moved sync ledger and lock persistence into explicit stores.
- Split provider harness files, especially Claude and Codex app-server mechanics, and made provider runtime environment flow through explicit job/registry contracts.
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

The latest slice split the viewer subsystem by directory ownership. HTTP/static serving now lives under `src/edges/viewer/`, viewer read-model APIs live under `src/services/viewer/`, and the old mixed `src/viewer/*.ts` source bucket is gone.

Verification passed: `npm run lint`, focused viewer/serve/boundary tests, full `npm test` with 655 tests, `npm run build`, `node dist/codealmanac.js --version`, and an isolated built `almanac serve` smoke that loaded the static UI and `/api/wikis`.

## Immediate Next Work

Continue top-down subsystem passes before small leak cleanup. The indexer warning, provider enablement, autoregistration registry-matching, harness provider environment, job-record PID paths, serve interrupt handling, setup/uninstall terminal sinks and input streams, setup guide package lookup, setup next-step wiki-state ownership, automation disabled-plist existence probing, doctor Node runtime version, doctor auth/automation/instruction/update probing, doctor index-db probing, doctor option cleanup, jobs PID liveness/signaling paths, lifecycle init request context, review command result rendering, and viewer edge/read-model split are now explicit. Remaining candidates include provider/platform mechanics, command workflow decisions, service taxonomy, and any remaining viewer read-model/storage duplication.

## Decision Log

There is now a standalone decision log:

- `decision-log.md` for durable rewrite decisions
- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice

Commit history remains the detailed record for individual landed boundaries.
