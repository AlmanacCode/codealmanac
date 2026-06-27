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

First production slice:

- Moved the process-level CLI runner from `src/cli.ts` to `src/edges/cli/run.ts`.
- Kept `src/cli.ts` as a stable facade so bin shims and tests can keep importing the public runner.
- Added `test/architecture-boundaries.test.ts` to prevent the facade from regaining Commander, command wiring, platform update checks, or job-worker behavior.

Second production slice:

- Moved CLI command registration, grouped help, and sqlite-free setup shortcut parsing into `src/edges/cli/`.
- Left command handlers in `src/cli/commands/` until their product-service ownership is explicit.
- Added an architecture guard that fails if terminal CLI shell files reappear under `src/cli/`.

Third production slice:

- Introduced `src/services/wiki/search.ts` as the first explicit wiki service.
- Moved search wiki resolution, index freshness, index opening, and query execution out of `src/cli/commands/search.ts`.
- Kept `src/cli/commands/search.ts` responsible for CLI output modes, color, stderr breadcrumbs, and exit shape.
- Introduced `src/services/wiki/page-view.ts` and moved page-view lookup for `show` out of the command adapter.
- Added architecture guards so `search` and `show` commands cannot re-import index storage mechanics directly.

Fourth production slice:

- Moved the generic compact duration parser from `src/wiki/indexer/duration.ts` to `src/shared/duration.ts`.
- Introduced `src/services/wiki/health.ts` so `almanac health` resolves wiki roots and collects reports through a service boundary.
- Kept `src/cli/commands/health/index.ts` responsible for CLI flag normalization, stdin slug parsing, report rendering, and warnings.
- Introduced `src/services/wiki/registry.ts` so `almanac list` no longer reads registry storage or filesystem reachability directly.
- Kept `src/cli/commands/list.ts` responsible for JSON/name/table output and exit text.

Fifth production slice:

- Moved global registry persistence from `src/wiki/registry/store.ts` to `src/stores/wiki-registry/store.ts`.
- Deleted the old `src/wiki/registry/index.ts` facade and updated callers to use the explicit store boundary.
- Moved slug tests from `test/registry.test.ts` to `test/slug.test.ts` so registry tests cover registry persistence only.

Sixth production slice:

- Moved current-repo auto-registration from `src/wiki/registry/autoregister.ts` to `src/services/wiki/autoregistration.ts`.
- Removed the remaining `src/wiki/registry/` product/persistence hybrid directory.
- Kept CLI edges responsible for choosing when a command should auto-register, while the service owns how the repo is detected and registered.

Seventh production slice:

- Introduced `src/services/wiki/topic-read.ts` for read-side topic workflows, exported through the stable `src/services/wiki/topics.ts` facade.
- Moved `topics list` and `topics show` index freshness, wiki-root resolution, index opening, and topic page lookup out of CLI command adapters.
- Left mutating topic commands for a later slice because they coordinate YAML edits, page frontmatter rewrites, cycle checks, and reindexing.

Eighth production slice:

- Moved the `topics describe` mutation workflow into `src/services/wiki/topic-mutations.ts`.
- Kept `src/cli/commands/topics/describe.ts` responsible only for mapping service statuses to CLI stdout/stderr/exit codes.
- Moved the `topics unlink` mutation workflow into the same service because it only edits `topics.yaml` and reindexes after an actual edge removal.
- Moved `topics create` and `topics link` into the topic service so parent validation, ad-hoc topic promotion, cycle checks, YAML writes, and reindexing share one product workflow boundary.
- Split the topic service implementation into `topic-read.ts`, `topic-mutations.ts`, `topic-types.ts`, and `topic-workspace.ts`; `topics.ts` is now only the stable facade import path.
- Moved `topics rename` and `topics delete` into `topic-mutations.ts`, moved page frontmatter rewriting to `topic-page-rewrite.ts`, and deleted the old CLI-local `topics/workspace.ts` helper.
- Moved `tag`/`untag` repo resolution, page lookup, topic auto-creation, frontmatter rewrites, and reindexing into `src/services/wiki/page-topic-mutations.ts`; `src/cli/commands/tag.ts` now renders structured service results.
