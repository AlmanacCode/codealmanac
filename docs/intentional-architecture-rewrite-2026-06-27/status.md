# Intentional Architecture Rewrite Status

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch has 197 committed rewrite commits past `dev`. The worklog records 151 production slices so far.

The diff is broad: 350 files changed, with about 20.5k insertions and 10.7k deletions.

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
- Audit viewer/server boundaries; most current work has focused on CLI, services, jobs, sync, automation, and providers.
- Run another broad review pass over the full branch before calling the rewrite merge-ready.

## Latest Checkpoint

The latest slice moved install diagnostics probing out of services. `src/platform/diagnostics/install.ts` now owns install-path detection, ephemeral-path classification, package-version reads, and the better-sqlite3 native-binding probe; doctor services consume the typed `installStatus` fact.

Verification passed: `npm run lint`, focused doctor/CLI/boundary tests, full `npm test` with 655 tests, `npm run build`, `git diff --check`, `node dist/codealmanac.js --version`, `node dist/codealmanac.js doctor --json`, and `node dist/codealmanac.js automation status`.

## Immediate Next Work

Continue checking services that still know too much about platform, provider, or CLI mechanics; command files that still own workflow decisions instead of request shaping and rendering; and large files whose size reflects mixed ownership rather than domain density. The indexer warning, provider enablement, autoregistration registry-matching, harness provider environment, job-record PID paths, serve interrupt handling, setup/uninstall terminal sinks and input streams, doctor Node runtime version, doctor auth/automation/instruction/update probing, doctor option cleanup, jobs PID liveness/signaling paths, lifecycle init request context, and review command result rendering are now explicit. Remaining candidates include provider/platform mechanics, command workflow decisions, and viewer API/read-model boundaries.

## Decision Log

There is now a standalone decision log:

- `decision-log.md` for durable rewrite decisions
- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice

Commit history remains the detailed record for individual landed boundaries.
