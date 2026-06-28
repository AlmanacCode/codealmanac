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

Twenty-seventh production slice:

- Introduced `src/services/automation/catalog.ts` so automation task parsing and default sync plist path lookup are exposed through the automation service boundary instead of `src/cli/commands/automation.ts` importing platform task definitions.
- Introduced `src/services/automation/legacy-hooks.ts` so setup workflows clean legacy hook files through the automation service boundary instead of importing platform cleanup directly.

Twenty-eighth production slice:

- Moved the `topics show` fallback title decision into the wiki topic read service so `src/cli/commands/topics/read.ts` renders the service record without importing `src/wiki/topics/yaml.ts`.
- Split `topicTitleFromSlug` into `src/wiki/topics/title.ts` so fallback title generation is a named topic helper instead of a YAML parser export.

Twenty-ninth production slice:

- Introduced `SetupSpawnCliFn` as the setup service-facing subprocess callback type.
- Updated setup command UI files to type `spawnCli` through `src/services/setup/index.ts` instead of importing `src/agent/types.ts` directly.
- Tightened architecture guards so setup command files cannot reintroduce direct `agent/` imports.

Thirtieth production slice:

- Introduced setup-owned public type aliases for provider view, model choice, and provider id contracts.
- Removed raw `agent/` and `config/` type re-exports from `src/services/setup/index.ts`.
- Updated setup command UI types so the command surface depends only on setup service names.

Thirty-first production slice:

- Introduced agents-service-owned public type aliases for provider view and readiness contracts.
- Removed raw `agent/readiness` type re-exports from `src/services/agents/index.ts`.
- Updated the agents command adapter to depend on agents service names instead of readiness implementation names.

Thirty-second production slice:

- Introduced diagnostics-owned public aliases for spawn callbacks, spawned processes, provider status, and provider id.
- Introduced a diagnostics-owned auth status contract and normalized Claude auth probe output into it inside the diagnostics probe wrapper.
- Removed the Claude provider path from `src/services/diagnostics/types.ts` so `DoctorOptions` no longer exposes a provider-local type import.
- Updated doctor tests to inject spawn callbacks through the diagnostics service contract instead of importing Claude readiness provider types.

Thirty-third production slice:

- Introduced `SyncWorkflowSummary` as the sync service-facing summary contract.
- Removed the raw `SyncSummary` re-export from `src/services/sync/index.ts`.
- Updated the sync command adapter to render the service-owned summary type instead of the lower-level sync subsystem type.

Thirty-fourth production slice:

- Introduced lifecycle-owned names for operation run results and provider selection parsing.
- Removed raw `operations` re-exports from `src/services/lifecycle/index.ts`.
- Updated the operation command adapter and tests to consume the lifecycle service contract instead of operation-layer symbols.

Thirty-fifth production slice:

- Introduced `JobServiceView` as the jobs service-facing read model.
- Removed the raw `JobView` re-export from `src/services/jobs/index.ts`.
- Updated the jobs command adapter to format the service-owned read model type.

Thirty-sixth production slice:

- Introduced service-owned `AutomationTaskId` and `AutomationExecFn` aliases.
- Moved the public automation task ID export from the platform-backed catalog to automation service types.
- Updated automation planning and legacy migration types to consume service-owned names instead of launchd/task scheduler types.

Thirty-seventh production slice:

- Introduced service-owned names for update registry checks, install spawning, and install results.
- Updated `UpdateOptions` and `UpdateWorkflowResult` to use update service contract names instead of raw platform update types.
- Guarded the update service facade against direct platform update exports.

Thirty-eighth production slice:

- Moved setup agent-choice config refresh/save ownership into `src/services/setup/agent-choice.ts`.
- Replaced the CLI's raw global config access with a setup-owned configured-model snapshot.
- Guarded setup agent-choice UI against reaching into `config.agent`.

Thirty-ninth production slice:

- Introduced `WikiReviewItem` and `WikiReviewStatus` as service-owned review contract names.
- Removed direct store type re-exports from `src/services/wiki/review-types.ts`.
- Updated the review command adapter to render service-owned review item/status names.

Fortieth production slice:

- Made `WikiTopicSummary` an explicit service read model instead of a query-layer alias.
- Mapped query topic summaries into the service-owned shape inside `src/services/wiki/topic-read.ts`.
- Guarded topic service types against importing query-layer contracts.

Forty-first production slice:

- Made search and page-view service result types explicit instead of aliases over `src/wiki/query/`.
- Added service-local mappers so query rows are normalized once before CLI formatters see them.
- Guarded the search and show service contracts against regressing to query-layer aliases.

Forty-second production slice:

- Made `ReindexWikiResult` a service-owned result instead of an alias over the indexer `IndexResult`.
- Mapped forced-indexer output at the reindex service boundary before the CLI formats it.
- Guarded the reindex service contract against regressing to an indexer type alias.

Forty-third production slice:

- Made `RegisteredWiki` a service-owned registry read model instead of an alias over the registry store entry.
- Mapped registry store rows at `src/services/wiki/registry.ts` before list command formatting.
- Guarded the list service contract against regressing to a store type alias.

Forty-fourth production slice:

- Made review command-facing item and status types explicit service contracts instead of aliases over the review store.
- Mapped review store items inside `src/services/wiki/reviews.ts` before returning service results.
- Guarded review service types against importing the store's persisted item/status contracts.

Forty-fifth production slice:

- Made `JobServiceView` an explicit service read model instead of an alias over the runtime `JobView`.
- Mapped runtime job views inside `src/services/jobs/jobs.ts` before returning command-facing service results.
- Guarded jobs service types against regressing to runtime job-view aliases.

Forty-sixth production slice:

- Made `MigrateLegacySourcesResult` a service-owned result instead of an alias over `wiki/sources`.
- Mapped legacy-source migration output inside `src/services/wiki/source-migration.ts`.
- Removed stale command-shaped `MigrateLegacySources*` exports from `src/wiki/sources/`.
- Guarded the migrate legacy-sources service contract and source package against regressing to lower-layer command aliases.

Forty-seventh production slice:

- Made `src/cli/commands/search.ts` own its CLI option shape instead of extending `SearchWikiPagesRequest`.
- Made `SearchResult` an explicit command JSON/display row instead of an alias over `WikiSearchResult`.
- Added a command-local mapper from the wiki search service result into the CLI output contract.
- Guarded the search adapter against regressing to service request/result aliases.

Forty-eighth production slice:

- Made `src/cli/commands/reindex.ts` own `ReindexOptions` instead of aliasing `ReindexWikiRequest`.
- Made the reindex command output carry an explicit `ReindexResult` instead of exposing `ReindexWikiResult`.
- Added command-local request/result mappers between the reindex adapter and wiki service.
- Guarded the reindex adapter against regressing to service request/result aliases.

Forty-ninth production slice:

- Made `src/cli/commands/show/types.ts` own the `ShowRecord` shape instead of aliasing `WikiPageView`.
- Added `showRecordFromWikiService` at the show adapter edge before formatting records.
- Copied nested file/source/cross-wiki link values into command-owned structures before rendering.
- Guarded show command types against importing or aliasing the service page-view contract.

Fiftieth production slice:

- Made `ConfigResult` an explicit config command output contract instead of an alias over `CommandResult`.
- Made `ReviewCommandOutput` an explicit review command output contract instead of an alias over `CommandResult`.
- Removed now-unneeded `CommandResult` imports from config and review command adapters.
- Guarded the review adapter against regressing to the generic command-result alias.

Fifty-first production slice:

- Made automation install, uninstall, and status command option shapes explicit in `src/cli/commands/automation.ts`.
- Removed the exported `AutomationOptions` service-type intersection and `AutomationStatusOptions` re-export from the command adapter.
- Added command-local mappers into service automation option contracts before calling install, uninstall, or status services.
- Guarded the automation command against regressing to service-owned option aliases.

Fifty-second production slice:

- Made `SyncWorkflowSummary` and its nested ready/started/skipped records explicit service workflow models.
- Mapped `sync.sweep()` runtime summaries into service-owned workflow summaries before returning from `runSyncWorkflow`.
- Kept runtime transcript sweep mechanics behind the sync service boundary while preserving the CLI render contract.
- Guarded the sync service against regressing to a direct `sync.SyncSummary` alias.

Fifty-third production slice:

- Made `UpdateInstallResult` an explicit update-service result instead of an alias over the platform installer result.
- Mapped `installLatestPackage()` output through `updateInstallResultFromPlatform` before returning an update workflow install result.
- Used neutral service fields (`output`, `errorOutput`, `code`) and mapped them back to CLI `stdout`, `stderr`, and `exitCode` in `src/cli/commands/update.ts`.
- Guarded update service types against regressing to a platform install-result alias.

Fifty-fourth production slice:

- Made `SyncCommandOptions` an explicit command input contract instead of extending `SyncWorkflowOptions`.
- Made `SyncCommandResult` an explicit sync command output contract instead of importing the generic `CommandResult`.
- Added `toSyncWorkflowOptions` at the sync command/service boundary.
- Guarded the sync command against regressing to service option inheritance or generic command output aliases.

Fifty-fifth production slice:

- Made init, absorb, and garden command option shapes explicit instead of extending lifecycle workflow service options.
- Made lifecycle operation commands return an explicit `OperationCommandResult` instead of the generic `CommandResult` alias.
- Added command-local mappers from init, absorb, and garden options into their lifecycle workflow service options.
- Guarded lifecycle command adapters against regressing to service option inheritance or generic command output aliases.

Fifty-sixth production slice:

- Made automation install, uninstall, and status commands return an explicit `AutomationCommandResult`.
- Removed the generic `CommandResult` import from the automation command adapter.
- Guarded the automation command against regressing to the generic command output alias.

Fifty-seventh production slice:

- Made jobs list, show/logs, attach, and cancel command option shapes explicit instead of inheriting from a broad `JobsOptions` base.
- Made jobs commands return an explicit `JobsCommandResult` instead of the generic `CommandResult` alias.
- Added command-local mappers into jobs service request contracts for list, by-id reads, streaming logs, and cancellation.
- Guarded the jobs command against regressing to generic output aliases or broad option inheritance.

Fifty-eighth production slice:

- Made `LifecycleOperationRunResult` an explicit lifecycle-service result instead of aliasing `operations.OperationRunResult`.
- Normalized operation-layer foreground/background run results once inside `src/services/lifecycle/operations.ts`.
- Updated lifecycle command rendering to consume the service-owned job/result shape.
- Guarded the lifecycle service against regressing to an operation-layer result alias.

Fifty-ninth production slice:

- Made `src/services/agents/` own its provider view, provider choice, readiness, provider id, and model-choice contracts.
- Added a mapper from the lower-level provider readiness view into the agents service read model.
- Kept the agents command rendering against the service-owned shape instead of the raw readiness view.
- Guarded the agents service against regressing to provider-readiness type aliases.

Sixtieth production slice:

- Made automation service task ids and exec function contracts explicit in `src/services/automation/types.ts`.
- Removed aliases to platform launchd and scheduled-task types from the automation service public surface.
- Guarded automation service types against re-exposing platform automation contracts.

Sixty-first production slice:

- Made setup agent-choice provider ids, readiness, model choices, provider choices, provider view, and spawn contracts explicit in `src/services/setup/agent-choice.ts`.
- Added a mapper from the provider readiness view into the setup service read model.
- Guarded setup agent-choice service types against regressing to lower-level provider/config aliases.

Sixty-second production slice:

- Made diagnostics provider ids, provider probe statuses, spawn functions, and spawned process contracts explicit in `src/services/diagnostics/types.ts`.
- Removed diagnostics service public aliases to agent provider/process types and config provider ids.
- Guarded diagnostics types against re-exposing agent/config contracts.

Sixty-third production slice:

- Made setup instruction target ids, target display rows, and instruction-change results explicit in `src/services/setup/instructions.ts`.
- Added mapping from agent instruction targets/results into setup-owned setup contracts.
- Guarded setup instructions against regressing to agent instruction type aliases.

Sixty-fourth production slice:

- Made setup uninstall options list setup guide directories directly instead of extending `AgentInstructionDirs`.
- Normalized agent instruction removal summaries into the setup uninstall result shape.
- Guarded setup uninstall against regressing to inherited agent instruction directory contracts.

Sixty-fifth production slice:

- Made update registry-check and npm-install spawn hooks explicit service-owned contracts in `src/services/update/types.ts`.
- Kept the platform npm installer behind a private update-service adapter instead of exposing `typeof spawn` as service API.
- Guarded update service types against regressing to platform check/spawn aliases.

Sixty-sixth production slice:

- Made wiki health reports and health collector hooks explicit service-owned contracts in `src/services/wiki/health.ts`.
- Normalized raw indexer health reports once inside the wiki health service before CLI or doctor rendering sees them.
- Moved doctor health checks onto the service-owned health collector contract instead of `typeof collectHealthReport`.

Sixty-seventh production slice:

- Flattened jobs read, stream, and cancel request contracts so each service verb lists its own required fields.
- Removed request-interface inheritance from `src/services/jobs/types.ts`.
- Guarded jobs service request types against reintroducing inherited base request contracts.

Sixty-eighth production slice:

- Flattened wiki topic read and mutation request contracts in `src/services/wiki/topic-types.ts`.
- Made each topic service verb list its own `cwd`, optional `wiki`, and topic-specific fields directly.
- Guarded topic service request types against reintroducing broad `WikiTopicsRequest` inheritance.

Sixty-ninth production slice:

- Flattened wiki review add, list, item, and change request contracts in `src/services/wiki/review-types.ts`.
- Made each review service verb list its own `cwd`, optional `wiki`, and review-specific fields directly.
- Guarded review service request types against reintroducing `WikiReviewRequest` inheritance.

Seventieth production slice:

- Flattened topic command option contracts in `src/cli/commands/topics/types.ts`.
- Removed the broad `TopicsBaseOptions` command surface and the `TopicsUnlinkOptions` inheritance from link options.
- Guarded topic command types against reintroducing inherited base option contracts.

Seventy-first production slice:

- Flattened review command option contracts in `src/cli/commands/review.ts`.
- Replaced the broad `ReviewOptions` base with explicit add, show, list, and item option contracts.
- Kept markdown extraction behind a tiny private helper input type rather than a public command inheritance chain.

Seventy-second production slice:

- Flattened `SyncWorkflowStartedItem` so started sync jobs own their full result payload instead of extending ready sync items.
- Made `syncWorkflowStartedItemFromSweep` map every field explicitly rather than spreading the ready-item mapper.
- Guarded the sync service against reintroducing started-item inheritance or mapper reuse.

Seventy-third production slice:

- Flattened lifecycle operation workflow option contracts in `src/services/lifecycle/operations.ts`.
- Replaced the broad `LifecycleOperationDeps` base with explicit init, absorb, and garden workflow fields.
- Added named lifecycle hook contracts so command options no longer index into workflow option interfaces for injected run hooks.

Seventy-fourth production slice:

- Flattened wiki topic and review workspace result contracts.
- Made editable topic workspaces list `repoRoot`, `db`, and `file` directly instead of extending the fresh-index shape.
- Made found review items list `file`, `path`, and `item` directly instead of extending the open-review-file shape.

Seventy-fifth production slice:

- Made lifecycle operation hook contracts explicit in `src/services/lifecycle/operations.ts`.
- Replaced lifecycle aliases to lower-level operation starters and absorb source resolution with service-owned request/result types.
- Kept the lifecycle service structurally compatible with operation and absorb internals while keeping its exported contract readable at the service boundary.

Seventy-sixth production slice:

- Made setup configured-model state explicit in `src/services/setup/agent-choice.ts`.
- Replaced the `Partial<Record<SetupAgentProviderId, string | null>>` alias with a service-owned `{ claude, codex, cursor }` contract.
- Normalized config model overrides once in `setupConfiguredModelsFromConfig` before setup UI reads them.

Seventy-seventh production slice:

- Split jobs command formatting and shared rendering out of `src/cli/commands/jobs.ts`.
- Added `src/cli/commands/jobs-format.ts` for job tables, detail views, elapsed-time labels, page-change summaries, and attach terminal summaries.
- Added `src/cli/commands/jobs-render.ts` for missing-wiki, missing-job, log-read, and cancel-result rendering.

Seventy-eighth production slice:

- Split setup stdin/input controls out of `src/cli/commands/setup/output.ts`.
- Added `src/cli/commands/setup/input.ts` for confirm prompts, text prompts, raw choice selection, and setup interruption handling.
- Kept `output.ts` focused on display constants, banners, step markers, and boxed next-step rendering.

Seventy-ninth production slice:

- Moved setup global-install path detection and npm install spawning into `src/platform/install/global-package.ts`.
- Deleted the command-local `src/cli/commands/setup/install-path.ts` platform helper.
- Kept `global-install-step.ts` focused on setup prompting, rendering, and step result orchestration.

Eightieth production slice:

- Added `src/platform/shell.ts` for inherited shell command execution.
- Moved provider login command spawning out of `src/cli/commands/setup/agent-choice.ts`.
- Kept setup agent choice focused on prompting, provider selection, readiness refresh, and model selection.

Eighty-first production slice:

- Split setup provider model selection into `src/cli/commands/setup/agent-model-choice.ts`.
- Moved model-choice formatting, friendly labels, and custom model prompting out of `agent-choice.ts`.
- Kept `agent-choice.ts` focused on provider readiness, login prompting, and saving the selected provider/model pair.

Eighty-second production slice:

- Split indexer page planning into `src/wiki/indexer/page-plan.ts`.
- Moved globbing, file stat/read handling, content hashing, frontmatter parsing, source normalization, and wikilink extraction out of `index.ts`.
- Kept `index.ts` focused on freshness orchestration, topic reconciliation, and SQLite write application.

Eighty-third production slice:

- Split indexer SQLite page writes into `src/wiki/indexer/page-writer.ts`.
- Moved prepared statements, transaction application, topic/file/source/link projection, and FTS row replacement out of `index.ts`.
- Kept `index.ts` as the orchestration layer for freshness, planning, page-write application, topic YAML reconciliation, and mtime bumping.

Eighty-fourth production slice:

- Split generic frontmatter block slicing into `src/wiki/topics/frontmatter-block.ts`.
- Kept `frontmatter-rewrite.ts` focused on topic-list transforms and topic-field replacement.
- Preserved the byte-level body and line-ending behavior required by tag, untag, and topic rename/delete workflows.

Eighty-fifth production slice:

- Split topic-list frontmatter scanning and formatting into `src/wiki/topics/frontmatter-topic-list.ts`.
- Moved flow/scalar/block topic parsing, comment stripping, scalar formatting, dedupe, and array comparison out of `frontmatter-rewrite.ts`.
- Kept `frontmatter-rewrite.ts` focused on applying caller transforms and replacing the exact `topics:` field span.

Eighty-sixth production slice:

- Split Codex app-server startup into `src/harness/providers/codex/app-server-session.ts`.
- Moved `initialize`, `thread/start`, `turn/start`, root thread/turn state assignment, provider-session event emission, and prompt/sandbox request construction out of `app-server.ts`.
- Kept `app-server.ts` focused on process lifetime, JSON-RPC transport, request dispatch, notification handling, timeout failure, and cleanup.

Eighty-seventh production slice:

- Split sync transcript snapshot and cursor decision logic into `src/sync/transcript-cursor.ts`.
- Moved transcript file reading, line counting, unchanged/pending/prefix-mismatch decisions, pending ledger entry construction, and failed-entry construction out of `src/sync/sweep.ts`.
- Kept `src/sync/sweep.ts` focused on candidate iteration, eligibility gates, repo locks, ledger loading/reconciliation, Absorb enqueue orchestration, summary recording, and lock cleanup.

Eighty-eighth production slice:

- Split wiki health checks by ownership into `src/wiki/health/page-checks.ts` and `src/wiki/health/link-checks.ts`.
- Moved page/topic checks, empty-page reads, and slug-collision scanning out of `src/wiki/health/index.ts`.
- Moved file-reference, wikilink, and cross-wiki reachability checks out of `src/wiki/health/index.ts`.
- Kept `src/wiki/health/index.ts` focused on index freshness, health-scope resolution, source-health composition, report assembly, and database lifetime.

Eighty-ninth production slice:

- Split Codex app-server JSON-RPC request tracking into `src/harness/providers/codex/app-server-rpc.ts`.
- Moved request ids, pending request timeout handling, response dispatch, server-request response helpers, and raw JSON-RPC message classification out of `app-server.ts`.
- Kept `src/harness/providers/codex/app-server.ts` focused on child process lifetime, stdout/stderr line collection, notification-to-harness mapping, root turn completion, failure handling, and cleanup.

Ninetieth production slice:

- Split structured source-frontmatter coercion into `src/wiki/indexer/frontmatter-sources.ts`.
- Moved the `FrontmatterSource` union, `sources:` list coercion, source-type switch, source-number/date coercion, and optional-field cleanup out of `frontmatter.ts`.
- Kept `src/wiki/indexer/frontmatter.ts` focused on frontmatter fence parsing, YAML loading, generic scalar/list fields, archive/supersession fields, body extraction, and H1 fallback.

Ninety-first production slice:

- Split lifecycle operation run-result read models and operation-result mapping into `src/services/lifecycle/operation-results.ts`.
- Moved job/foreground/background result contracts and `lifecycleOperationRunResultFromOperation()` out of `src/services/lifecycle/operations.ts`.
- Kept `src/services/lifecycle/operations.ts` focused on init/absorb/garden workflow orchestration, provider resolution, JSON foreground rejection, and init command context construction.

Ninety-second production slice:

- Split sync sweep read-model contracts, summary builders, skip builders, and cursor context text into `src/sync/sweep-results.ts`.
- Moved `SyncSummary`/`SyncStarted`/`SyncReady`/`SyncSkipped` and the scheduled-sync cursor prompt text out of `src/sync/sweep.ts`.
- Kept `src/sync/sweep.ts` focused on candidate iteration, quiet-window and activation gates, internal-run filtering, repo locks, ledger reconciliation, Absorb enqueueing, and ledger writes.

Ninety-third production slice:

- Split persisted config patch construction into `src/stores/config/stored-patch.ts`.
- Moved raw-object cloning, minimal stored-value updates, default pruning, legacy `capture_since` removal, and empty-object pruning out of `src/stores/config/store.ts`.
- Kept `src/stores/config/store.ts` focused on config file paths, legacy config migration, raw config reads, user/project merge reads, atomic writes, and automation sync timestamp ensuring.

Ninety-fourth production slice:

- Split job run projection concerns out of `src/jobs/projections/view.ts` into named projection modules.
- Moved agent trace derivation into `src/jobs/projections/agent-traces.ts`, warning derivation into `src/jobs/projections/warnings.ts`, and shared text helpers into `src/jobs/projections/text.ts`.
- Kept `src/jobs/projections/view.ts` focused on display title, subtitle, transcript source, and enriched job run view assembly.

Ninety-fifth production slice:

- Split background worker process spawning into `src/jobs/background-process.ts`.
- Moved child-process imports, default detached spawn mechanics, worker argv construction, and spawn hook typing out of `src/jobs/start.ts`.
- Kept `src/jobs/start.ts` focused on durable foreground/queued/background job records, specs, logs, cancellation checks, failure marking, and execution handoff.

Ninety-sixth production slice:

- Split setup command contracts into `src/cli/commands/setup/types.ts`.
- Moved `SetupOptions`, `SetupResult`, and the setup `AutomationExecFn` hook type out of `src/cli/commands/setup/index.ts`.
- Kept `src/cli/commands/setup/index.ts` focused on the setup TUI workflow while preserving its public type re-exports for existing callers.

Ninety-seventh production slice:

- Split sync workflow contracts into `src/services/sync/types.ts`.
- Moved `SyncWorkflowOptions`, `SyncWorkflowSummary`, item shapes, and result union out of `src/services/sync/sync.ts`.
- Kept `src/services/sync/sync.ts` focused on source parsing, sweep orchestration, provider selection, and Absorb handoff.

Ninety-eighth production slice:

- Split Codex app-server root turn detection into `src/harness/providers/codex/app-server-root-turn.ts`.
- Moved root turn/thread completion checks and notification turn ID extraction out of the app-server process run loop.
- Kept `src/harness/providers/codex/app-server.ts` focused on process lifecycle, RPC wiring, notification mapping, timeout handling, and result finalization.

Ninety-ninth production slice:

- Split source frontmatter rewrite mechanics into `src/wiki/sources/frontmatter-fix.ts`.
- Moved YAML parsing, legacy source classification, deterministic source ID generation, and frontmatter byte reconstruction out of `src/wiki/sources/maintenance.ts`.
- Kept `src/wiki/sources/maintenance.ts` focused on indexed page selection, scoped migration traversal, atomic page writes, and reindexing.

One-hundredth production slice:

- Split agent and config CLI registration into `src/edges/cli/register-agent-commands.ts` and `src/edges/cli/register-config-commands.ts`.
- Moved `agents` and `config` command-family wiring out of `src/edges/cli/register-setup-commands.ts`.
- Kept setup registration focused on setup, doctor, update, and uninstall command wiring.

One-hundred-first production slice:

- Split jobs service view normalization into `src/services/jobs/view.ts`.
- Moved runtime `JobView` to service `JobServiceView` mapping and terminal display-status detection out of `src/services/jobs/jobs.ts`.
- Kept `src/services/jobs/jobs.ts` focused on list/read/log/cancel/stream service verbs over job records and logs.

One-hundred-second production slice:

- Split background job start lifecycle into `src/jobs/background-start.ts`.
- Moved background spec persistence, queued record creation, log initialization, worker process launch, and launch-failure marking out of `src/jobs/start.ts`.
- Kept `src/jobs/start.ts` focused on foreground execution and claimed queued-job execution.

One-hundred-third production slice:

- Split lifecycle command rendering into `src/cli/commands/operations-render.ts`.
- Moved operation result rendering, JSON foreground rejection output, and foreground failure message formatting out of `src/cli/commands/operations.ts`.
- Kept `src/cli/commands/operations.ts` focused on converting command options into lifecycle workflow options and rendering the returned workflow result through a named command-private renderer.

One-hundred-fourth production slice:

- Split codealmanac bootstrap process spawning into `src/platform/install/bootstrap-process.ts`.
- Moved inherited spawn, captured spawn, child event handling, and stdio buffering out of `src/platform/install/global.ts`.
- Kept `src/platform/install/global.ts` focused on durable global-install bootstrap decisions, package-root resolution, version comparison, and setup rerun flow.

One-hundred-fifth production slice:

- Split wiki review command rendering into `src/cli/commands/review-render.ts`.
- Moved review-item formatting, list formatting, success messages, JSON output, and review command error rendering out of `src/cli/commands/review.ts`.
- Kept `src/cli/commands/review.ts` focused on reading CLI markdown input, calling wiki review services, and routing service result variants to the command-private renderer.

One-hundred-sixth production slice:

- Split wiki review YAML codec concerns into `src/stores/wiki-review/codec.ts`.
- Moved review-file YAML parsing, serialization, record normalization, duplicate-ID validation, and YAML error shaping out of `src/stores/wiki-review/store.ts`.
- Kept `src/stores/wiki-review/store.ts` focused on `.almanac/review.yaml` path resolution, file loading, atomic writes, summary extraction, and review ID generation while preserving its public type exports.

One-hundred-seventh production slice:

- Split automation command rendering into `src/cli/commands/automation-render.ts`.
- Moved automation install/status/uninstall output strings, task labels, legacy capture status rendering, and activation failure formatting out of `src/cli/commands/automation.ts`.
- Kept `src/cli/commands/automation.ts` focused on command option contracts, service option conversion, and invoking automation service workflows.

One-hundred-eighth production slice:

- Finished the jobs command rendering split in `src/cli/commands/jobs-render.ts`.
- Moved jobs list/show JSON output, empty-list text, attach empty-log text, and streaming terminal summary rendering out of `src/cli/commands/jobs.ts`.
- Kept `src/cli/commands/jobs.ts` focused on converting command options into jobs service requests and invoking jobs service workflows.

One-hundred-ninth production slice:

- Split sync command rendering into `src/cli/commands/sync-render.ts`.
- Moved sync success/error result rendering, status/live mode labels, ready/started item text, and needs-attention text out of `src/cli/commands/sync.ts`.
- Kept `src/cli/commands/sync.ts` focused on command option contracts, sync workflow option conversion, and invoking the sync service workflow.

One-hundred-tenth production slice:

- Split tag and untag command rendering into `src/cli/commands/tag-render.ts`.
- Moved tagged/no-change/missing-page output, validation error text, and tag/untag exit-code decisions out of `src/cli/commands/tag.ts`.
- Kept `src/cli/commands/tag.ts` focused on command contracts and invoking page-topic mutation service workflows.

One-hundred-eleventh production slice:

- Split agents command rendering into `src/cli/commands/agents-render.ts`.
- Moved provider list/doctor formatting, readiness labels, unknown-agent errors, missing-model errors, and model/default-agent success text out of `src/cli/commands/agents.ts`.
- Kept `src/cli/commands/agents.ts` focused on reading the agents service view and invoking agents configuration service workflows.

One-hundred-twelfth production slice:

- Split topic command rendering into `src/cli/commands/topics/read-render.ts` and `src/cli/commands/topics/mutation-render.ts`.
- Moved topic list/show formatting, JSON output, success messages, shared topic errors, DAG edge messages, and page-count text out of individual topic verb adapters.
- Deleted the old `src/cli/commands/topics/read.ts` helper so topic read presentation has an honest home next to mutation presentation.

One-hundred-thirteenth production slice:

- Split config command rendering into `src/cli/commands/config-render.ts`.
- Moved config table/JSON output, unknown-key text, missing-value text, rejected mutation output, and set/unset success text out of `src/cli/commands/config.ts`.
- Kept `src/cli/commands/config.ts` focused on parsing config keys and invoking config service workflows.

One-hundred-fourteenth production slice:

- Split update command rendering into `src/cli/commands/update-render.ts`.
- Moved update workflow result text, registry failure output, deprecated notifier warnings, and install result output mapping out of `src/cli/commands/update.ts`.
- Kept `src/cli/commands/update.ts` focused on invoking the update service workflow.

One-hundred-fifteenth production slice:

- Split migrate command rendering into `src/cli/commands/migrate-render.ts`.
- Moved legacy source migration JSON/text output, ambiguous-source warnings, automation migration outcome text, and automation install failure rendering out of `src/cli/commands/migrate.ts`.
- Kept `src/cli/commands/migrate.ts` focused on shaping migrate command inputs and invoking source/automation migration services.

One-hundred-sixteenth production slice:

- Split search command rendering into `src/cli/commands/search-render.ts`.
- Moved search JSON output, colored slug output, summary output, empty-result stderr breadcrumbs, and large-result warnings out of `src/cli/commands/search.ts`.
- Kept `src/cli/commands/search.ts` focused on building wiki search service requests, applying command-level limits, and normalizing service rows into command result rows.

One-hundred-seventeenth production slice:

- Split list command rendering into `src/cli/commands/list-render.ts`.
- Moved registry list JSON output, human-readable wiki list formatting, empty verbose hints, and drop result text out of `src/cli/commands/list.ts`.
- Kept `src/cli/commands/list.ts` focused on selecting the registry service workflow for normal list versus explicit drop.

One-hundred-eighteenth production slice:

- Split uninstall command rendering into `src/cli/commands/uninstall-render.ts`.
- Moved uninstall prompt text, kept-step lines, setup cleanup summaries, automation removal formatting, and completion text out of `src/cli/commands/uninstall.ts`.
- Kept `src/cli/commands/uninstall.ts` focused on CLI option defaults, interactive yes/no decisions, and invoking the setup uninstall service.

One-hundred-nineteenth production slice:

- Split health command rendering into `src/cli/commands/health/render.ts`.
- Moved health JSON output, text report sections, colorized category rows, and legacy-source migration warnings out of `src/cli/commands/health/index.ts`.
- Kept `src/cli/commands/health/index.ts` focused on stale-duration parsing, stdin slug parsing, and invoking the wiki health service.

One-hundred-twentieth production slice:

- Split show command result rendering into `src/cli/commands/show/render.ts`.
- Moved missing-input output, missing-page stderr, exit-code selection, and delegation to show record formatting out of `src/cli/commands/show/index.ts`.
- Kept `src/cli/commands/show/index.ts` focused on slug collection, wiki page service reads, and service-record normalization into the command record contract.

One-hundred-twenty-first production slice:

- Split doctor command rendering into `src/cli/commands/doctor/render.ts`.
- Moved doctor JSON output, text report selection, and command-result shaping out of `src/cli/commands/doctor/index.ts`.
- Kept `src/cli/commands/doctor/index.ts` focused on invoking the diagnostics service and preserving the public diagnostic type exports.

One-hundred-twenty-second production slice:

- Split reindex command rendering into `src/cli/commands/reindex-render.ts`.
- Moved explicit reindex summary wording, page-count pluralization, and skipped-file suffix formatting out of `src/cli/commands/reindex.ts`.
- Kept `src/cli/commands/reindex.ts` focused on invoking the wiki reindex service and mapping service results into the command contract.

One-hundred-twenty-third production slice:

- Split serve startup rendering into `src/cli/commands/serve-render.ts`.
- Moved the `almanac serve` startup URL and Ctrl+C instruction text out of `src/cli/commands/serve.ts`.
- Kept `src/cli/commands/serve.ts` focused on viewer server lifetime, interrupt waiting, and guaranteed server cleanup.

One-hundred-twenty-fourth production slice:

- Made `streamJobsAttach` require an explicit stream writer instead of defaulting to `process.stdout`.
- Moved the `jobs attach` stdout writer into `src/edges/cli/register-jobs-commands.ts`.
- Kept `src/cli/commands/jobs.ts` focused on jobs service request mapping and command result rendering delegation.

One-hundred-twenty-fifth production slice:

- Made the doctor command receive terminal color capability from the CLI edge instead of reading `process.stdout.isTTY` inside the formatter.
- Removed the unused diagnostics `stdout` option that only existed to support render-time color inference.
- Kept diagnostics options service-facing while `src/cli/commands/doctor/render.ts` owns JSON/text render options.

One-hundred-twenty-sixth production slice:

- Made automation install planning receive the base CLI program arguments explicitly instead of deriving them inside `src/platform/automation/tasks.ts`.
- Added `src/edges/cli/current-cli.ts` as the only owner of current CLI argv/path discovery for scheduled task commands.
- Kept setup's ephemeral/global install commands as explicit per-task overrides for `/usr/bin/env almanac ...`.
- Added architecture guards so the automation task catalog cannot reintroduce `process.argv`, `process.cwd()`, or `process.execPath`.

One-hundred-twenty-seventh production slice:

- Made background job startup receive an explicit worker program `{ command, entrypoint }` instead of reading `process.execPath` or `process.argv[1]` inside `src/jobs/`.
- Reused the CLI-edge `currentCliNodeProgram()` helper for lifecycle commands and sync commands that can enqueue background jobs.
- Threaded the worker program through lifecycle, operation, Absorb, and sync service contracts so background worker launch facts stay edge-owned.
- Added architecture guards so `src/jobs/background-process.ts` cannot reintroduce `process.execPath` and `src/jobs/background-start.ts` cannot reintroduce `process.argv`.

One-hundred-twenty-eighth production slice:

- Made Claude and Codex harness providers receive the environment through provider dependencies instead of letting lower request/option builders read `process.env`.
- Threaded the explicit environment into Claude SDK option construction and Codex app-server request construction.
- Added architecture guards so `src/harness/providers/claude/options.ts` and `src/harness/providers/codex/request.ts` cannot reintroduce direct `process.env` reads.
- Added `decision-log.md` because the rewrite is now long enough that durable architectural decisions need a direct home.

One-hundred-twenty-ninth production slice:

- Replaced the bare readiness `spawnCli` argument with an explicit `AgentProviderRuntime` context containing `spawnCli` and `environment`.
- Made Claude readiness and Claude auth read `ANTHROPIC_API_KEY` from that context instead of directly reading `process.env`.
- Threaded environment through agents, setup, doctor, and sqlite-free setup shortcut entrypoints.
- Added an architecture guard so `src/agent/readiness/view.ts`, Claude readiness, and Claude auth cannot reintroduce direct `process.env` reads.

One-hundred-thirtieth production slice:

- Made indexer warnings an explicit callback instead of direct `process.stderr` writes inside frontmatter parsing, page planning, or topics YAML application.
- Threaded the warning sink through the force-reindex service and CLI edge so explicit `almanac reindex` still surfaces non-fatal indexing warnings.
- Replaced stderr monkey-patching tests with direct warning-sink assertions.
- Added an architecture guard so indexer modules cannot reintroduce terminal output ownership.

One-hundred-thirty-first production slice:

- Removed `process.env` defaults from provider enablement helpers in `src/agent/provider-enablement.ts`.
- Made provider recommendation and setup agent selection receive the already-threaded environment explicitly.
- Removed the unused provider-list message helper from readiness view.
- Added an architecture guard so provider enablement cannot reintroduce ambient environment reads.

One-hundred-thirty-second production slice:

- Moved snapshot registry path matching behind the wiki-registry store contract with `findRegistryEntry`.
- Removed the duplicated `samePath` helper and `process.platform` read from autoregistration.
- Kept autoregistration on a single registry snapshot while letting the store own case-insensitive path matching.
- Added an architecture guard so autoregistration cannot reintroduce platform-specific path equality.

One-hundred-thirty-third production slice:

- Replaced the singleton harness provider registry with `createHarnessProviderRegistry({ environment })`.
- Removed the remaining `process.env` defaults from the Claude and Codex harness provider factories.
- Threaded `workerEnvironment` through foreground jobs, queued workers, and the job executor so default harness runs receive edge-owned runtime facts.
- Updated harness/job tests and added an architecture guard so harness providers and the registry cannot reintroduce ambient environment ownership.

One-hundred-thirty-fourth production slice:

- Made job-record PIDs explicit across foreground job start, queued worker claiming, lifecycle operation workflows, operation command adapters, and sync-triggered Absorb starts.
- Removed `process.pid` defaults from `src/jobs/record-factory.ts` and `src/jobs/start.ts`; CLI edges now pass the current process id when invoking foreground operations or the internal worker.
- Kept lock-owner and temp-file PIDs inside stores/platform code because those are persistence and platform mechanics rather than product job-record ownership.
- Added an architecture guard so job record startup, record construction, and worker claiming cannot reintroduce ambient process id reads.

One-hundred-thirty-fifth production slice:

- Moved `almanac serve` interrupt waiting out of `src/viewer/server.ts` and into the CLI edge at `src/edges/cli/interrupt.ts`.
- Made `runServe` receive an explicit `waitForStop` boundary instead of owning process signal handlers.
- Kept `src/viewer/server.ts` focused on HTTP/API/static serving and server cleanup through `close()`.
- Added a focused serve command test and architecture guard so viewer/server cannot reintroduce process signal ownership.

One-hundred-thirty-sixth production slice:

- Made setup and uninstall command entrypoints receive their stdout sink and stdin TTY fact explicitly.
- Moved the remaining setup/uninstall `process.stdout` and `process.stdin.isTTY` defaults into CLI edge callers, including the sqlite-free setup shortcut.
- Kept setup prompt-input internals unchanged for this slice; deeper prompt input ownership remains separate work.
- Added architecture guards so setup and uninstall command modules cannot reintroduce terminal sink or TTY ownership.

One-hundred-thirty-seventh production slice:

- Removed platform process imports from `src/services/jobs/jobs.ts` and `src/services/jobs/view.ts`.
- Made job liveness and cancellation signaling explicit service contract inputs instead of optional hooks with platform defaults.
- Split job-log command requests away from job-view requests so log reads do not need PID liveness.
- Moved CLI jobs registration to provide `isLocalPidAlive` and `signalLocalPid` from the platform layer.
- Added architecture guards so jobs services cannot reintroduce platform process ownership.

One-hundred-thirty-eighth production slice:

- Moved review command service-result rendering into `src/cli/commands/review-render.ts`.
- Kept `src/cli/commands/review.ts` focused on request shaping, markdown/stdin input shaping, and review service verb calls.
- Preserved status-specific JSON and text behavior while making the render module own service-result-to-output branching.
- Added an architecture guard so the review command cannot reintroduce result-status switches or direct JSON/text rendering.

One-hundred-thirty-ninth production slice:

- Added an explicit `SetupInputStream` to the setup command contract.
- Moved setup prompt helpers, target selection, provider/model selection, setup planning, and global install prompts off direct `process.stdin` reads.
- Kept the CLI edge and sqlite-free setup shortcut as the owners of the real process stdin stream.
- Updated interactive setup tests to write to injected streams instead of global stdin and added an architecture guard against setup command modules reintroducing direct stdin ownership.

One-hundred-fortieth production slice:

- Made `DoctorOptions.nodeVersion` required instead of letting install diagnostics default to `process.version`.
- Moved the real Node version read into `src/edges/cli/register-setup-commands.ts` for `almanac doctor`.
- Kept `src/services/diagnostics/install.ts` focused on composing install checks from explicit diagnostic facts.
- Added an architecture guard so diagnostics services cannot reintroduce `process.version` ownership.

One-hundred-forty-first production slice:

- Added an explicit stdin stream to the uninstall command contract.
- Moved uninstall confirmation prompts off direct `process.stdin` reads.
- Kept `src/edges/cli/register-setup-commands.ts` as the owner of the real process stdin stream for `almanac uninstall`.
- Added an interactive uninstall test that answers prompts through the injected stream and an architecture guard against direct uninstall stdin ownership.

One-hundred-forty-second production slice:

- Added an explicit init request context field to the lifecycle workflow contract.
- Moved init command-context prose from `src/services/lifecycle/operations.ts` into `src/cli/commands/operations.ts`.
- Kept the lifecycle service focused on provider resolution and operation execution, not command request wording.
- Added a behavior assertion for the generated init context and a boundary guard against lifecycle services owning command-context prose.

One-hundred-forty-third production slice:

- Added an explicit `automationStatus` fact to the doctor diagnostics contract.
- Moved launchd sync plist and legacy capture-sweep detection into `src/platform/diagnostics/automation.ts`.
- Kept `src/services/diagnostics/install.ts` focused on describing install checks from facts rather than importing platform automation modules.
- Added platform probe coverage and an architecture guard against install diagnostics re-owning automation platform mechanics.

One-hundred-forty-fourth production slice:

- Added explicit guide and agent-instruction status facts to the doctor diagnostics contract.
- Moved home-directory guide and agent-instruction probing into `src/platform/diagnostics/instructions.ts`.
- Kept `src/services/diagnostics/install.ts` focused on describing install checks from typed facts instead of checking filesystem paths.
- Added platform probe coverage and boundary guards against install diagnostics re-owning guide or instruction filesystem mechanics.

One-hundred-forty-fifth production slice:

- Removed unused `settingsPath`, `almanacDir`, and `hookScriptPath` fields from the doctor diagnostics options contract.
- Kept doctor overrides limited to fields with current callers or tests.
- Added an architecture guard so dead doctor injection knobs do not return as compatibility residue.

One-hundred-forty-sixth production slice:

- Added an explicit `authStatus` fact to the doctor diagnostics contract.
- Moved Claude auth probing for `almanac doctor` into `src/platform/diagnostics/auth.ts`.
- Kept `src/services/diagnostics/install.ts` focused on describing install checks from typed facts rather than invoking provider auth mechanics.
- Added platform probe coverage and boundary guards against diagnostics services re-owning Claude auth probing.

One-hundred-forty-seventh production slice:

- Added an explicit `updateStatus` fact to the doctor diagnostics contract.
- Moved doctor update-state/config probing into `src/platform/diagnostics/updates.ts`.
- Kept `src/services/diagnostics/updates.ts` focused on rendering update checks from typed facts.
- Moved the pure version comparator from `src/platform/update/semver.ts` to `src/shared/version.ts` so service code no longer imports platform update mechanics for semver comparison.
- Removed the doctor-only state reader from the update notifier worker and added boundary guards against diagnostics services re-owning update state/config reads.

One-hundred-forty-eighth production slice:

- Made automation `homeDir` explicit from CLI edges through command/setup adapters into automation services.
- Removed `homedir()` defaults from automation planning, status, uninstall, migration, and legacy-hook cleanup service surfaces.
- Removed the unused sync automation plist-path compatibility export from the automation service catalog.
- Added boundary guards so automation services cannot reintroduce ambient home-directory ownership and command options keep carrying `homeDir` explicitly.

One-hundred-forty-ninth production slice:

- Made setup instruction installation require an explicit `homeDir` instead of defaulting to `homedir()` inside `src/services/setup/instructions.ts`.
- Threaded the existing setup command `homeDir` through the guide-install step into the setup service.
- Added boundary guards so setup instruction services cannot reintroduce ambient home-directory ownership.

One-hundred-fiftieth production slice:

- Made sync workflow options require an explicit `homeDir` instead of defaulting to `homedir()` inside `src/services/sync/sync.ts`.
- Threaded `homeDir` from `src/edges/cli/register-sync-commands.ts` through `src/cli/commands/sync.ts` into the sync service.
- Added boundary guards so sync services cannot reintroduce ambient home-directory ownership.

One-hundred-fifty-first production slice:

- Moved install diagnostics probing from `src/services/diagnostics/probes.ts` to `src/platform/diagnostics/install.ts`.
- Added a typed `installStatus` fact to the doctor diagnostics contract so services describe install path, version, and SQLite-binding facts instead of probing the machine directly.
- Removed the old doctor `installPath`, `versionOverride`, and `sqliteProbe` compatibility knobs in favor of one install-status contract.
- Added boundary guards so doctor services cannot re-own install-path detection, package-version reads, or native SQLite probing.

One-hundred-fifty-second production slice:

- Moved bundled setup guide directory discovery from `src/services/setup/instructions.ts` to `src/platform/install/guides.ts`.
- Made setup instruction installation consume an explicit `guidesDir` instead of resolving package layout inside the setup service.
- Threaded the bundled guide directory from `src/edges/cli/register-setup-commands.ts`, while keeping `--skip-guides` lazy so skipped work does not inspect package files.
- Added boundary guards so setup instruction services cannot re-own `createRequire`, `fileURLToPath`, or guide-file existence probing.

One-hundred-fifty-third production slice:

- Removed direct filesystem existence probing from `src/services/automation/automation.ts`.
- Let `src/platform/automation/launchd.ts` remain the owner of deciding whether a launchd plist exists before removal.
- Kept the automation service focused on the install plan decision: if the plan disables Garden, ask platform automation to remove that plist.
- Added a boundary guard so automation services cannot reintroduce `existsSync`.

One-hundred-fifty-fourth production slice:

- Moved setup next-step wiki page counting from `src/services/setup/wiki-state.ts` to `src/services/wiki/setup-state.ts`.
- Removed the setup service export for `readSetupWikiState` so setup no longer owns wiki filesystem state.
- Kept `src/cli/commands/setup/index.ts` as the consumer that renders next steps from the wiki-state read model.
- Added boundary guards so setup services cannot re-own wiki-state filesystem scanning.

One-hundred-fifty-fifth production slice:

- Moved wiki doctor index count and freshness probing into `src/wiki/indexer/diagnostics.ts`.
- Kept `src/services/wiki/doctor-index.ts` focused on formatting typed index diagnostics into doctor checks.
- Kept `src/services/wiki/doctor.ts` as the composer that refreshes the index, asks the indexer for diagnostics, and aggregates wiki doctor checks.
- Added boundary guards so doctor services cannot re-own SQLite, file-existence, mtime, or `SELECT COUNT` mechanics.

One-hundred-fifty-sixth production slice:

- Split the viewer subsystem by ownership: HTTP/static serving moved to `src/edges/viewer/`, while viewer read-model APIs moved to `src/services/viewer/`.
- Updated `almanac serve` to call the viewer edge instead of the old mixed `src/viewer/server.ts` bucket.
- Made the viewer edge wire platform PID-liveness into the viewer service so service read models no longer import `src/platform/process.ts`.
- Removed the old `src/viewer/*.ts` source bucket and added boundary guards around the new viewer edge/service split.

One-hundred-fifty-seventh production slice:

- Moved the provider execution runtime out of the old top-level `src/harness/` bucket into `src/agent/runtime/`.
- Renamed runtime contracts and factories from `Harness*` to `AgentRuntime*` so the type vocabulary matches the new provider-runtime ownership.
- Moved managed child-process cleanup from `src/harness/process/` to `src/platform/managed-child.ts`.
- Updated provider, job, lifecycle, operation, CLI-rendering, absorb, and focused runtime tests to consume the new runtime boundary.
- Added boundary coverage that the old top-level harness source path does not return.

One-hundred-fifty-eighth production slice:

- Removed the old top-level `src/sync/` source bucket.
- Moved Claude/Codex local transcript-store scanning and raw JSONL normalization into `src/platform/transcripts/`.
- Moved sync sweep coordination, cursor decisions, ledger reconciliation helpers, and summary shaping under `src/services/sync/`.
- Kept sync ledger and lock persistence in `src/stores/sync/`.
- Added boundary coverage that transcript discovery stays platform-owned while sync workflow decisions stay service-owned.

One-hundred-fifty-ninth production slice:

- Removed the old top-level `src/operations/` and `src/absorb/` source buckets.
- Moved Build/Absorb/Garden operation spec and run construction into `src/services/lifecycle/operations/`.
- Moved Absorb input parsing, source-ref parsing, source input contracts, context rendering, and Absorb run-start shaping into `src/services/lifecycle/absorb/`.
- Moved GitHub remote/source resolution mechanics into `src/platform/github/source.ts` so platform code returns plain typed source facts without importing lifecycle service types.
- Added `runPreparedAbsorbOperationWorkflow()` so sync can start prepared transcript Absorb jobs through the public lifecycle service instead of importing operation internals.
- Updated boundary coverage so the old operation/absorb buckets stay deleted, sync uses lifecycle workflow contracts, and GitHub platform mechanics do not import lifecycle services.

One-hundred-sixtieth production slice:

- Removed the old top-level `src/jobs/` source bucket.
- Moved job execution lifecycle, foreground/background start, queue selection, event logging, finalization, page snapshotting, wiki-effect accounting, and worker draining into `src/services/jobs/runtime/`.
- Moved job run projections, parsed log events, agent traces, warnings, and display-title enrichment into `src/services/jobs/projections/`.
- Moved durable job record types, record validation, and log-entry envelopes into `src/stores/jobs/` alongside record/spec/log/lock persistence.
- Moved detached worker process spawning into `src/platform/jobs/worker-process.ts`.
- Updated lifecycle, sync, viewer, CLI worker-entry, and tests to use the service/store/platform job boundaries instead of importing `src/jobs/`.
- Added boundary coverage that `src/jobs/` stays deleted and that job runtime, projections, persisted schemas, and process spawning stay in their owned homes.

One-hundred-sixty-first production slice:

- Removed the old top-level `src/init/` source bucket.
- Moved wiki initialization into `src/services/wiki/initialization.ts` so `initWiki()` reads as a wiki product workflow shared by CLI tests and Build.
- Moved mechanical `.almanac/` directory creation, starter README writes, and runtime `.gitignore` writes into `src/stores/wiki-files/scaffold.ts`.
- Updated Build and tests to import initialization through the wiki service boundary instead of a loose top-level helper.
- Added boundary coverage that `src/init/` stays deleted, wiki initialization does not own raw file writes, and file scaffolding does not own registry writes.

One-hundred-sixty-second production slice:

- Removed the old top-level `src/config/` source bucket.
- Moved persisted config schema, TOML/JSON codec, raw-object editing, origin tracking, config paths, legacy migration, and atomic config writes into `src/stores/config/`.
- Moved agent provider enablement policy into `src/agent/provider-enablement.ts` so Cursor enablement and enabled-provider lists live with agent/provider identity instead of config storage.
- Updated services, platform update checks, lifecycle provider selection, setup, tests, and command surfaces to use the new store and agent/provider boundaries.
- Added boundary coverage that `src/config/` stays deleted and that config stores do not export provider-enable policy.

One-hundred-sixty-third production slice:

- Removed the old top-level `src/wiki/` source bucket.
- Moved local wiki SQLite indexing, query plans, health checks, topic YAML/frontmatter rewrites, and source-frontmatter maintenance into `src/stores/wiki/`.
- Kept `src/services/wiki/` as the product workflow layer that resolves requests, shapes user-facing results, coordinates store mechanics, and owns wiki verbs.
- Updated viewer, job runtime wiki effects, lifecycle tests, wiki services, and direct store tests to import wiki mechanics from `src/stores/wiki/`.
- Added boundary coverage that `src/wiki/` stays deleted and command adapters do not import wiki store mechanics directly.

One-hundred-sixty-fourth production slice:

- Removed the `src/services/viewer/` service bucket.
- Moved viewer-only API DTO assembly, global wiki listing, review payloads, job payloads, and viewer job response types into `src/edges/viewer/read-model/`.
- Kept `src/edges/viewer/server.ts` as the HTTP/static route owner that wires platform PID liveness into the viewer read model.
- Updated viewer tests and architecture-boundary guards so the old `src/services/viewer/` and `src/viewer/` source buckets stay deleted.
- Updated living wiki pages and the codebase map to point at the viewer edge/read-model home.

One-hundred-sixty-fifth production slice:

- Moved the hidden internal job worker entrypoint into `src/edges/worker/job-worker.ts`.
- Renamed the service-side queued job runner to `src/services/jobs/runtime/queue-drain.ts`.
- Kept queue selection, worker-lock use, queued spec rehydration, queued-job failure marking, and `startQueuedJob()` orchestration in the job service runtime.
- Updated CLI internal worker dispatch and worker tests to import the edge entrypoint instead of the job service runtime facade.
- Added boundary coverage that `src/services/jobs/runtime/worker.ts` stays deleted while the edge entrypoint delegates to `drainQueuedJobs()`.

One-hundred-sixty-sixth production slice:

- Added `src/stores/jobs/index.ts` as the public jobs-store API over record, log, spec, and cancellation persistence mechanics.
- Moved job record construction/finalization from `src/services/jobs/runtime/record-factory.ts` to `src/services/jobs/record-lifecycle.ts`.
- Moved `toJobView()` display-status shaping from `src/services/jobs/runtime/record-view.ts` to `src/services/jobs/record-view.ts`.
- Updated `src/services/jobs/jobs.ts` so list/read/log/cancel/stream service verbs use store APIs instead of reading files, resolving record paths, or importing the job runtime facade.
- Updated `src/edges/viewer/read-model/jobs.ts` so viewer job payloads use stores plus service read-model/projection helpers instead of importing `src/services/jobs/runtime/index.ts`.
- Added boundary coverage that the public jobs service and viewer read model stay out of job runtime and raw storage path mechanics.

One-hundred-sixty-seventh production slice:

- Removed the old mixed `src/platform/automation/tasks.ts` file.
- Added `src/services/automation/tasks.ts` for sync, Garden, and update task definitions, default intervals, command arguments, labels, and working-directory policy.
- Added `src/platform/automation/paths.ts` for launchd plist paths, legacy capture plist paths, and automation log paths.
- Updated automation planning, install/status/uninstall workflows, migration, diagnostics, and task parsing to use the new service/platform split.
- Added boundary coverage that service task definitions do not own `LaunchAgents` path mechanics and platform path helpers do.

One-hundred-sixty-eighth production slice:

- Added `src/platform/diagnostics/types.ts` for doctor probe result contracts: spawn callbacks, auth facts, automation facts, guide/instruction facts, update facts, install facts, and SQLite probe facts.
- Updated platform diagnostic probes to import their typed results from the platform diagnostics package instead of depending upward on `src/services/diagnostics/`.
- Kept `src/services/diagnostics/types.ts` focused on doctor options, reports, checks, and agent read models while re-exporting platform probe facts for stable service and command callers.
- Added boundary coverage that platform diagnostics do not import `services/diagnostics` and that services intentionally depend on the platform diagnostic fact contracts.

One-hundred-sixty-ninth production slice:

- Added `src/services/setup/provider-fix-command.ts` for provider fix-command normalization and execution over platform shell mechanics.
- Updated `src/cli/commands/setup/agent-choice.ts` so the setup TUI asks for confirmation and renders status, while the setup service owns the fix-command workflow.
- Removed the direct `platform/shell.js` import from the setup agent-choice TUI file.
- Strengthened boundary coverage so setup provider-login process execution stays behind the setup service and platform shell boundary.

One-hundred-seventieth production slice:

- Added `src/services/setup/global-install.ts` for setup global-install state and execution over platform install package mechanics.
- Updated `src/cli/commands/setup/global-install-step.ts` so the setup TUI prompts/renders while the setup service owns install path and global npm install workflow.
- Removed the direct `platform/install/global-package.js` import from the setup global-install TUI file.
- Strengthened boundary coverage so setup global-install package-manager mechanics stay behind setup service and platform install boundaries.

One-hundred-seventy-first production slice:

- Added `src/platform/transcripts/snapshot.ts` for raw transcript file reads, line counting, and JSONL timestamp cursor boundaries.
- Updated sync ledger/cursor services so they consume typed transcript snapshots and timestamp boundaries instead of parsing raw transcript files directly.
- Kept sync services responsible for product decisions: quiet-window eligibility, ledger cursor status, prefix mismatch handling, and Absorb enqueueing.
- Strengthened boundary coverage so transcript file mechanics stay in platform transcripts while sync cursor decisions stay in services.

One-hundred-seventy-second production slice:

- Deleted the `src/services/jobs/runtime/index.ts` compatibility barrel after moving all callers to owned modules.
- Updated lifecycle operation callers to import job start functions from concrete runtime files and `JobWorkerProgram` from `src/platform/jobs/worker-process.ts`.
- Updated sync to read job records through `src/stores/jobs/index.ts` instead of the job runtime facade.
- Updated job-related tests to import record lifecycle, store persistence, worker lock, logs, snapshots, and runtime execution helpers from their owning modules.
- Strengthened boundary coverage so the mixed job runtime barrel stays deleted.

One-hundred-seventy-third production slice:

- Moved `almanac serve` server-lifetime orchestration from `src/cli/commands/serve.ts` to `src/edges/cli/serve.ts`.
- Moved serve startup rendering from `src/cli/commands/serve-render.ts` to `src/edges/cli/serve-render.ts`.
- Deleted the old command files instead of leaving compatibility paths.
- Updated command registration so `serve` imports the CLI-edge runner directly.
- Strengthened boundary coverage so `src/cli/commands/serve.ts` and `src/cli/commands/serve-render.ts` stay deleted while viewer HTTP serving remains under `src/edges/viewer/`.

One-hundred-seventy-fourth production slice:

- Added `src/platform/automation/job-plan.ts` for concrete automation scheduler job construction.
- Moved launch PATH construction, automation log path assembly, plist path fallback, and `LaunchdJobDefinition` knowledge out of `src/services/automation/planning.ts`.
- Kept automation service planning responsible for product policy: task selection, interval validation, quiet-window validation, command arguments, and working-directory policy.
- Strengthened boundary coverage so service planning does not import launchd/path mechanics directly while the platform job-plan owns those mechanics.

One-hundred-seventy-fifth production slice:

- Removed the unused `readJobLogEvents(path)` helper from `src/services/jobs/projections/log-events.ts`.
- Removed the direct `node:fs/promises` dependency from job log projections.
- Kept job projections responsible for parsing log contents and deriving typed event/read-model facts.
- Strengthened boundary coverage so log file reads stay behind `src/stores/jobs/`.

One-hundred-seventy-sixth production slice:

- Added `src/stores/wiki-files/pages.ts` for `.almanac/pages/*.md` counting.
- Removed page-count filesystem reads from the Build operation and setup wiki state service.
- Kept Build and setup services responsible for product behavior: rebuild gating, existing-page counts, and user-facing setup state.
- Strengthened boundary coverage so page-file counting mechanics stay in `src/stores/wiki-files/`.

One-hundred-seventy-seventh production slice:

- Added `src/stores/wiki-files/absorb-logs.ts` for scanning `.almanac/logs` and `.almanac/` absorb log/jsonl files.
- Removed direct filesystem scanning from `src/services/wiki/doctor-absorb.ts`.
- Kept the wiki doctor service responsible for formatting the `wiki.absorb` check from a store-owned latest-log fact.
- Strengthened boundary coverage so absorb-log file mechanics stay in `src/stores/wiki-files/`.
