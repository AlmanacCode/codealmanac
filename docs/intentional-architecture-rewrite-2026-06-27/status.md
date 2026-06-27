# Intentional Architecture Rewrite Status

Date: 2026-06-27
Branch: `codex/intentional-architecture-rewrite`

## Current State

The branch is clean and pushed.

The rewrite has landed 172 commits past `dev`. The worklog records 126 production slices so far. The diff is broad: more than 300 files changed, with about 18k insertions and 9.8k deletions.

This is no longer a small cleanup branch. It is a real ownership rewrite.

## Done

- Created the rewrite contract and branch-specific worklog.
- Moved CLI process execution and command registration into `src/edges/cli/`.
- Made CLI command files much thinner by moving product workflows into `src/services/`.
- Split wiki workflows into clearer service boundaries: search, show, health, registry, topics, review, reindex, source migration, and doctor wiki checks.
- Moved durable job persistence into explicit stores for records, specs, logs, and worker locks.
- Moved sync ledger and lock persistence into explicit stores.
- Split provider harness files, especially Claude and Codex app-server mechanics.
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

## Immediate Next Work

The current next slice should inspect the remaining non-edge `process.*` reads and decide which are legitimate platform mechanics versus runtime facts that should be passed from an edge.

## Decision Log

There is not yet a separate formal decision log for this branch. The current decision record is split between:

- `rewrite-contract.md` for the target architecture and rules
- `worklog.md` for what changed slice by slice
- commit history for individual landed boundaries

If this branch continues much longer, add `decision-log.md` for durable choices that are bigger than one slice.
