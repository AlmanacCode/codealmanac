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
- Moved review queue IDs, status transitions, timestamps, and `.almanac/review.yaml` store writes into `src/services/wiki/reviews.ts`; `src/cli/commands/review.ts` now maps service outcomes to stdout/stderr/JSON.
- Moved `migrate legacy-sources` wiki-root resolution and source-frontmatter migration call into `src/services/wiki/source-migration.ts`; `src/cli/commands/migrate.ts` now parses stdin and renders migration results.
- Moved doctor wiki checks into `src/services/wiki/doctor.ts`, deleted the old CLI-local `doctor/wiki.ts`, and moved the doctor duration formatter into `src/shared/duration.ts`.
- Split the catch-all `src/services/wiki/topic-mutations.ts` into `topic-description.ts`, `topic-graph-mutations.ts`, and `topic-page-mutations.ts`; the stable `topics.ts` facade still exports the same service verbs.
- Split page-topic request/result contracts and page input resolution out of `src/services/wiki/page-topic-mutations.ts`, and moved raw page-file lookup SQL into `query.pages.pageFilePathBySlug`.
- Moved `.almanac/review.yaml` persistence from the ambiguous `src/review/store.ts` path to the explicit `src/stores/wiki-review/store.ts` boundary.
- Split review service contracts, markdown/timestamp helpers, and wiki-root review-file opening out of `src/services/wiki/reviews.ts`; the workflow file now owns only add/list/show/decide/apply/reopen transitions.
- Split wiki doctor probes into `doctor-registry.ts`, `doctor-index.ts`, `doctor-absorb.ts`, `doctor-health.ts`, and `doctor-types.ts`; `doctor.ts` now only composes the wiki diagnostics report.

Ninth production slice:

- Introduced `src/services/update/` so update checking, dismissal, package installation, and update-lock handling sit behind one product workflow boundary.
- Kept `src/cli/commands/update.ts` responsible for CLI output and sqlite-free command compatibility only.
- Introduced `src/services/config/` so config key validation, config persistence, and user/project writes no longer live in the command adapter.
- Introduced `src/services/agents/` so provider readiness, default-provider writes, and model override writes are owned by an agent service instead of `src/cli/commands/agents.ts`.

Tenth production slice:

- Introduced `src/services/sync/` as the owner of the `almanac sync` workflow.
- Moved source parsing, quiet-window parsing, `automation.sync_since` loading, transcript discovery, provider selection caching, and background Absorb startup out of `src/cli/commands/sync.ts`.
- Kept `src/cli/commands/sync.ts` responsible only for mapping service errors through `renderError()` and rendering the `SyncSummary` for text or JSON output.
- Added an architecture guard so the sync command cannot re-import transcript discovery, operation execution, config loading, duration parsing, or provider-resolution helpers directly.

Eleventh production slice:

- Introduced `src/services/lifecycle/` as the command-facing lifecycle workflow boundary for `init`, `absorb`/`ingest`, and `garden`.
- Moved provider resolution, JSON foreground-mode rejection, init command context construction, and foreground/background operation start calls out of `src/cli/commands/operations.ts`.
- Kept `src/operations/` focused on provider-neutral operation spec construction and kept `src/cli/commands/operations.ts` focused on rendering operation results and failures.
- Added an architecture guard so lifecycle command adapters cannot re-import `src/operations/` or `src/absorb/` run-start mechanics directly.

Twelfth production slice:

- Changed `src/services/update/update.ts` to return typed workflow states instead of final CLI stdout/stderr/exit objects.
- Moved update command text rendering into `src/cli/commands/update.ts`, while keeping platform npm install output as the update integration boundary.
- Added an architecture guard so update workflow code does not reintroduce `stdout:`, `stderr:`, or `exitCode:` command rendering.

Thirteenth production slice:

- Moved durable job record path resolution, legacy `.almanac/runs/` fallback reads, cancel markers, atomic JSON writes, and record listing into `src/stores/jobs/records.ts`.
- Split the old catch-all `src/jobs/records.ts` into `record-factory.ts`, `record-schema.ts`, `record-view.ts`, and the explicit store file.
- Kept `src/jobs/index.ts` as the public jobs facade while removing the ambiguous `src/jobs/records.ts` module.

Fourteenth production slice:

- Moved durable job spec JSON path resolution, legacy fallback reads, validation, and atomic writes into `src/stores/jobs/specs.ts`.
- Moved durable job log initialization and JSONL appends into `src/stores/jobs/logs.ts`.
- Split job log entry construction into `src/jobs/log-entry.ts`, leaving `src/jobs/logs.ts` as a small event-to-store adapter and deleting the old `src/jobs/spec.ts` storage file.

Fifteenth production slice:

- Moved job worker lock path resolution, legacy lock checks, lock owner files, stale-owner detection, and release mechanics into `src/stores/jobs/worker-lock.ts`.
- Left `src/jobs/queue.ts` responsible only for selecting the oldest queued job from stored records.

Review pass after job-store slices:

- Read `.claude/agents/review.md`, `CLAUDE.md`, and the changed job/store files.
- Found no correctness regressions in the record/spec/log/worker-lock split.
- Residual risk to watch: job stores intentionally import job domain schemas and types for validation; that is acceptable while stores only own persistence mechanics, but it should not turn into product workflow ownership.

Sixteenth production slice:

- Moved repo-local sync ledger JSON path resolution, legacy ledger fallback reads, normalization, and atomic writes into `src/stores/sync/ledger.ts`.
- Moved repo-level sync lock path resolution, legacy lock cleanup, lock owner files, stale-owner detection, and release mechanics into `src/stores/sync/lock.ts`.
- Kept `src/sync/ledger.ts` for cursor math and pending-job reconciliation semantics, and kept `src/sync/sweep.ts` as the coordinator over eligibility, locking, ledger state, and Absorb enqueueing.

Seventeenth production slice:

- Added `src/platform/process.ts` for local PID liveness checks and process signaling.
- Replaced duplicated `process.kill(pid, 0)` helpers in job services, viewer jobs, worker-lock storage, and sync-lock storage with the platform helper.

Eighteenth production slice:

- Moved `almanac show` into the multi-file command layout used by other larger commands.
- Kept `src/cli/commands/show/index.ts` as the thin command entrypoint: collect page slugs, call the wiki page-view service, render missing-page errors, and delegate output formatting.
- Moved show output rendering into `src/cli/commands/show/format.ts`, slug collection into `src/cli/commands/show/slugs.ts`, and command contracts into `src/cli/commands/show/types.ts`.
- Preserved the existing `show` behavior with focused `show` and architecture-boundary tests before broader verification.

Nineteenth production slice:

- Split the old catch-all CLI lifecycle registration file into command-family modules under `src/edges/cli/`.
- Moved foreground lifecycle event formatting into `src/edges/cli/lifecycle-events.ts`.
- Kept lifecycle operation registration, sync registration, jobs registration, automation registration, and reindex registration in separate files so each edge module has one reason to change.
- Preserved the existing root command order and option surface with focused CLI registration tests.

Twentieth production slice:

- Split deterministic edit command registration by command family under `src/edges/cli/`.
- Kept `src/edges/cli/register-edit-commands.ts` as a small facade over review, page-topic, migrate, and topic registration.
- Moved review command wiring to `register-review-commands.ts`, tag/untag wiring to `register-page-topic-commands.ts`, migration wiring to `register-migrate-commands.ts`, and topic DAG wiring to `register-topics-commands.ts`.
- Preserved existing root and subcommand order with focused CLI, topics, review, and tag tests.

Twenty-first production slice:

- Split Claude harness-provider mechanics into provider-local modules under `src/harness/providers/claude/`.
- Kept `src/harness/providers/claude.ts` as the stable provider construction and run-loop entrypoint.
- Moved SDK option construction, managed Claude process spawning, tool/subagent mapping, event normalization, failure classification, usage parsing, and shared Claude trace types into named files.
- Added an architecture guard so the Claude provider shell does not re-absorb option construction, event translation, failure parsing, usage parsing, or process spawning.

Twenty-second production slice:

- Split Codex app-server environment/sandbox policy into `src/harness/providers/codex/app-server-config.ts`.
- Split noninteractive server-request response policy into `src/harness/providers/codex/server-requests.ts`.
- Kept `src/harness/providers/codex/app-server.ts` focused on process ownership, JSON-RPC request/response tracking, notification routing, turn completion, and cleanup.
- Added an architecture guard so the JSON-RPC run loop does not re-absorb env parsing or the server-request response table.

Twenty-third production slice:

- Introduced `src/services/setup/` for setup product workflows that need agent readiness and persisted config state.
- Moved setup agent-choice state loading, provider selection validation, model-choice lookup, readiness refresh, and final config persistence behind `src/services/setup/agent-choice.ts`.
- Moved setup auto-commit config reads/writes behind `src/services/setup/auto-commit.ts`.
- Moved setup instruction-target catalog, guide directory resolution, guide install mechanics, and guide marker exports behind `src/services/setup/instructions.ts`.
- Moved uninstall automation cleanup and agent-instruction removal behind `src/services/setup/uninstall.ts`.
- Kept `src/cli/commands/setup/agent-choice.ts` responsible for terminal prompting, choice formatting, login command prompting, and step output.
- Added architecture guards so setup UI steps do not re-import config, readiness, install-target, guide install, or automation cleanup mechanics directly.

Twenty-fourth production slice:

- Introduced `src/services/diagnostics/` for the `almanac doctor` diagnostic read model.
- Moved install probes, agent readiness checks, update checks, package/version probes, and doctor report contracts out of `src/cli/commands/doctor/`.
- Kept `src/cli/commands/doctor/index.ts` responsible for JSON/text response selection and `src/cli/commands/doctor/format.ts` responsible for terminal rendering.

Twenty-fifth production slice:

- Moved legacy capture-sweep automation migration into `src/services/automation/migration.ts`.
- Kept `src/cli/commands/migrate.ts` responsible for migration command rendering while the automation service owns legacy plist detection, sync install, and legacy plist removal.

Twenty-sixth production slice:

- Introduced `src/services/wiki/reindex.ts` for the explicit wiki reindex workflow.
- Kept `src/cli/commands/reindex.ts` responsible for the one-line CLI summary while the wiki service owns wiki-root resolution and forced index rebuild execution.
