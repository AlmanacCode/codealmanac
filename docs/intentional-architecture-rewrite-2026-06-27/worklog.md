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
