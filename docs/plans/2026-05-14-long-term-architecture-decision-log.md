# Long-Term Architecture Cleanup Decision Log

Branch: `codex/long-term-arch-cleanup`

Plan: `docs/plans/2026-05-14-long-term-architecture-cleanup.md`

## Decisions

### Use a follow-up branch after the squash merge

The provider/automation boundary refactor was squash-merged into `dev` as `a5da4cb`. This cleanup starts from `origin/dev` on a new branch so any follow-up review can evaluate it separately from the already-merged architectural work.

### Remove internal compatibility shims

The old `src/update/config.ts` and `src/agent/provider-view.ts` paths are not public CLI surfaces. Keeping them makes source search and future agent navigation more confusing. This cleanup will update internal imports and tests, then delete the shims.

### Do not build an "automate anything" framework yet

The long-term automation goal is broader, but the current product has two scheduled tasks: capture sweep and Garden. This cleanup can make task definitions more explicit, but it should not introduce a generic automation abstraction without a third real task or command-level product surface.

