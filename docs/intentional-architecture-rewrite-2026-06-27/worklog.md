# Intentional Architecture Rewrite Worklog

## 2026-06-27

Created branch `codex/intentional-architecture-rewrite` from `dev` at `fa39e76`.

Read local repo guidance:

- `MANUAL.md`
- `.almanac/README.md`
- `.agents/skills/deep-refactor-audit/SKILL.md`

Read relevant wiki pages:

- `accidental-special-case-architecture`
- `lifecycle-architecture`
- `provider-lifecycle-boundary`

Read architecture inspiration from `/Users/kushagrachitkara/Documents/almanac`:

- `docs/python-data-flow-ownership.md`
- `docs/python-core-contract.md`
- `docs/python-port-live-agreement.md`
- `CLAUDE.md`

Initial evidence:

- Current tree has useful boundaries, but the top-level vocabulary mixes historical implementation names with current product responsibilities.
- The largest production files are provider adapters, wiki indexing, CLI command files, sync sweep, wiki health, jobs, and config.
- The clearest rewrite direction is not a language port. It is an ownership rewrite: edge -> app -> services -> stores/integrations.

Initial decision:

- Write a rewrite contract before production code changes.
- Do not use arbitrary file-size caps. Use size as a smell that ownership may be mixed.
- Keep `dev` untouched. Commit work on `codex/intentional-architecture-rewrite`.

