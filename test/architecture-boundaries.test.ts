import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries", () => {
  it("keeps src/cli.ts as a stable facade over the CLI edge runner", async () => {
    const facade = await readSource("src/cli.ts");

    expect(facade).toContain("from \"./edges/cli/run.js\"");
    expect(facade).not.toContain("from \"commander\"");
    expect(facade).not.toContain("cli/commands");
    expect(facade).not.toContain("platform/");
    expect(facade).not.toContain("jobs/");
  });

  it("keeps process-level CLI machinery inside the CLI edge", async () => {
    const runner = await readSource("src/edges/cli/run.ts");

    expect(runner).toContain("from \"commander\"");
    expect(runner).toContain("tryRunInternalJob");
    expect(runner).toContain("readPackageVersion");
  });

  it("keeps CLI registration and shortcut parsing in the CLI edge", () => {
    const oldCliShellFiles = [
      "src/cli/help.ts",
      "src/cli/sqlite-free.ts",
      "src/cli/register-commands.ts",
      "src/cli/register-query-commands.ts",
      "src/cli/register-edit-commands.ts",
      "src/cli/register-setup-commands.ts",
      "src/cli/register-wiki-lifecycle-commands.ts",
      "src/edges/cli/register-wiki-lifecycle-commands.ts",
    ];

    for (const path of oldCliShellFiles) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it("keeps search command adapters out of index storage mechanics", async () => {
    const searchCommand = await readSource("src/cli/commands/search.ts");
    const searchService = await readSource("src/services/wiki/search.ts");

    expect(searchCommand).toContain("services/wiki/search.js");
    expect(searchCommand).not.toContain("wiki/indexer");
    expect(searchCommand).not.toContain("openIndex");
    expect(searchCommand).not.toContain("resolveWikiRoot");
    expect(searchCommand).not.toContain(
      "SearchOptions extends SearchWikiPagesRequest",
    );
    expect(searchCommand).not.toContain("SearchResult = WikiSearchResult");
    expect(searchService).not.toContain("export type WikiSearchResult = query");
  });

  it("keeps show command adapters out of index storage mechanics", async () => {
    const showCommand = await readSource("src/cli/commands/show/index.ts");
    const showTypes = await readSource("src/cli/commands/show/types.ts");
    const pageViewService = await readSource("src/services/wiki/page-view.ts");

    expect(showCommand).toContain("services/wiki/page-view.js");
    expect(showCommand).not.toContain("wiki/indexer");
    expect(showCommand).not.toContain("openIndex");
    expect(showCommand).not.toContain("resolveWikiRoot");
    expect(showTypes).not.toContain("WikiPageView");
    expect(showTypes).not.toContain("ShowRecord =");
    expect(pageViewService).not.toContain("export type WikiPageView = query");
  });

  it("keeps health command adapters out of index storage mechanics", async () => {
    const healthCommand = await readSource("src/cli/commands/health/index.ts");

    expect(healthCommand).toContain("services/wiki/health.js");
    expect(healthCommand).not.toContain("wiki/indexer");
    expect(healthCommand).not.toContain("../../../wiki/health");
    expect(healthCommand).not.toContain("collectHealthReport");
    expect(healthCommand).not.toContain("resolveWikiRoot");
  });

  it("keeps reindex command adapters out of index storage mechanics", async () => {
    const reindexCommand = await readSource("src/cli/commands/reindex.ts");
    const reindexService = await readSource("src/services/wiki/reindex.ts");

    expect(reindexCommand).toContain("services/wiki/reindex.js");
    expect(reindexCommand).not.toContain("wiki/indexer");
    expect(reindexCommand).not.toContain("runIndexer");
    expect(reindexCommand).not.toContain("resolveWikiRoot");
    expect(reindexCommand).not.toContain(
      "ReindexOptions = ReindexWikiRequest",
    );
    expect(reindexCommand).not.toContain("result: ReindexWikiResult;");
    expect(reindexService).not.toContain("export type ReindexWikiResult = IndexResult");
  });

  it("keeps list command adapters out of registry storage mechanics", async () => {
    const listCommand = await readSource("src/cli/commands/list.ts");
    const registryService = await readSource("src/services/wiki/registry.ts");

    expect(listCommand).toContain("services/wiki/registry.js");
    expect(listCommand).not.toContain("../../wiki/registry");
    expect(listCommand).not.toContain("readRegistry");
    expect(listCommand).not.toContain("dropEntry");
    expect(listCommand).not.toContain("existsSync");
    expect(registryService).not.toContain("export type RegisteredWiki = RegistryEntry");
  });

  it("keeps topic read command adapters out of index storage mechanics", async () => {
    const topicsListCommand = await readSource("src/cli/commands/topics/list.ts");
    const topicsShowCommand = await readSource("src/cli/commands/topics/show.ts");
    const topicsReadCommand = await readSource("src/cli/commands/topics/read.ts");
    const topicTypes = await readSource("src/services/wiki/topic-types.ts");

    for (const source of [topicsListCommand, topicsShowCommand, topicsReadCommand]) {
      expect(source).toContain("services/wiki/topics.js");
      expect(source).not.toContain("wiki/indexer");
      expect(source).not.toContain("openIndex");
      expect(source).not.toContain("resolveWikiRoot");
    }
    expect(topicsReadCommand).not.toContain("wiki/topics/yaml");
    expect(topicsReadCommand).not.toContain("titleCase");
    expect(topicTypes).not.toContain("wiki/query");
    expect(topicTypes).not.toContain("query.");
  });

  it("keeps service-backed topic mutation adapters out of write mechanics", async () => {
    const createCommand = await readSource("src/cli/commands/topics/create.ts");
    const deleteCommand = await readSource("src/cli/commands/topics/delete.ts");
    const describeCommand = await readSource("src/cli/commands/topics/describe.ts");
    const linkCommand = await readSource("src/cli/commands/topics/link.ts");
    const renameCommand = await readSource("src/cli/commands/topics/rename.ts");
    const unlinkCommand = await readSource("src/cli/commands/topics/unlink.ts");

    for (const source of [
      createCommand,
      deleteCommand,
      describeCommand,
      linkCommand,
      renameCommand,
      unlinkCommand,
    ]) {
      expect(source).toContain("services/wiki/topics.js");
      expect(source).not.toContain("wiki/indexer");
      expect(source).not.toContain("wiki/topics/yaml");
      expect(source).not.toContain("runIndexer");
      expect(source).not.toContain("openFreshTopicsWorkspace");
    }

    expect(existsSync(join(ROOT, "src/cli/commands/topics/workspace.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/topics/page-rewrite.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/wiki/topic-mutations.ts"))).toBe(false);
  });

  it("keeps tag command adapters out of page topic write mechanics", async () => {
    const tagCommand = await readSource("src/cli/commands/tag.ts");
    const pageTopicService = await readSource(
      "src/services/wiki/page-topic-mutations.ts",
    );

    expect(tagCommand).toContain("services/wiki/page-topic-mutations.js");
    expect(tagCommand).not.toContain("wiki/indexer");
    expect(tagCommand).not.toContain("wiki/topics");
    expect(tagCommand).not.toContain("resolveWikiRoot");
    expect(tagCommand).not.toContain("openIndex");
    expect(tagCommand).not.toContain("runIndexer");
    expect(tagCommand).not.toContain("rewritePageTopics");
    expect(tagCommand).not.toContain("loadTopicsFile");
    expect(tagCommand).not.toContain("writeTopicsFile");

    expect(pageTopicService).not.toContain("SELECT file_path FROM pages");
    expect(pageTopicService).not.toContain("openIndex");
    expect(pageTopicService).not.toContain("indexDbPath");
  });

  it("keeps review command adapters out of review store mechanics", async () => {
    const reviewCommand = await readSource("src/cli/commands/review.ts");
    const reviewService = await readSource("src/services/wiki/reviews.ts");
    const reviewTypes = await readSource("src/services/wiki/review-types.ts");

    expect(reviewCommand).toContain("services/wiki/reviews.js");
    expect(reviewCommand).not.toContain("review/store");
    expect(reviewCommand).not.toContain("stores/wiki-review");
    expect(reviewCommand).not.toContain("resolveWikiRoot");
    expect(reviewCommand).not.toContain("reviewYamlPath");
    expect(reviewCommand).not.toContain("loadReviewFile");
    expect(reviewCommand).not.toContain("writeReviewFile");
    expect(reviewCommand).not.toContain("nextReviewId");
    expect(reviewCommand).not.toContain("type ReviewItem");
    expect(reviewCommand).not.toContain("type ReviewStatus");
    expect(reviewCommand).not.toContain("ReviewCommandOutput = CommandResult");

    expect(reviewService).not.toContain("resolveWikiRoot");
    expect(reviewService).not.toContain("reviewYamlPath");
    expect(reviewService).not.toContain("loadReviewFile");
    expect(reviewService).not.toContain("function clean");
    expect(reviewService).not.toContain("function isReviewStatusFilter");
    expect(reviewTypes).not.toContain("stores/wiki-review");
    expect(reviewTypes).not.toContain("StoredReview");
    expect(reviewTypes).not.toContain("export type {");
  });

  it("keeps jobs command adapters out of job storage and process mechanics", async () => {
    const jobsServiceIndex = await readSource("src/services/jobs/index.ts");
    const jobsServiceTypes = await readSource("src/services/jobs/types.ts");
    const jobsCommand = await readSource("src/cli/commands/jobs.ts");

    expect(jobsServiceIndex).not.toContain("../../jobs");
    expect(jobsServiceTypes).not.toContain("RuntimeJobView");
    expect(jobsServiceTypes).not.toContain("JobView as");
    expect(jobsCommand).toContain("services/jobs/index.js");
    expect(jobsCommand).not.toContain("../../jobs/index");
    expect(jobsCommand).not.toContain("readJobRecord");
    expect(jobsCommand).not.toContain("writeJobRecord");
    expect(jobsCommand).not.toContain("resolveJobRecordPath");
    expect(jobsCommand).not.toContain("resolveJobLogPath");
    expect(jobsCommand).not.toContain("finishJobRecord");
    expect(jobsCommand).not.toContain("process.kill");
  });

  it("keeps job record persistence in an explicit store", () => {
    expect(existsSync(join(ROOT, "src/stores/jobs/records.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/jobs/records.ts"))).toBe(false);
  });

  it("keeps job spec and log persistence in explicit stores", () => {
    expect(existsSync(join(ROOT, "src/stores/jobs/specs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/logs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/jobs/spec.ts"))).toBe(false);
  });

  it("keeps worker lock persistence out of job queue selection", async () => {
    const queue = await readSource("src/jobs/queue.ts");

    expect(existsSync(join(ROOT, "src/stores/jobs/worker-lock.ts"))).toBe(true);
    expect(queue).not.toContain("worker.lock");
    expect(queue).not.toContain("mkdir");
    expect(queue).not.toContain("process.kill");
  });

  it("keeps sync runtime persistence in explicit stores", async () => {
    const syncLedger = await readSource("src/sync/ledger.ts");
    const syncSweep = await readSource("src/sync/sweep.ts");

    expect(existsSync(join(ROOT, "src/stores/sync/ledger.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/sync/lock.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/sync/lock.ts"))).toBe(false);
    expect(syncLedger).not.toContain("sync-ledger.json");
    expect(syncLedger).not.toContain("capture-ledger.json");
    expect(syncLedger).not.toContain("mkdir");
    expect(syncSweep).not.toContain("sync.lock");
  });

  it("keeps local process signaling in the platform layer", async () => {
    const jobsService = await readSource("src/services/jobs/jobs.ts");
    const viewerJobs = await readSource("src/viewer/jobs.ts");
    const jobWorkerLockStore = await readSource("src/stores/jobs/worker-lock.ts");
    const syncLockStore = await readSource("src/stores/sync/lock.ts");

    expect(existsSync(join(ROOT, "src/platform/process.ts"))).toBe(true);
    for (const source of [jobsService, viewerJobs, jobWorkerLockStore, syncLockStore]) {
      expect(source).not.toContain("process.kill");
    }
  });

  it("keeps automation command adapters out of launchd workflow mechanics", async () => {
    const automationServiceIndex = await readSource("src/services/automation/index.ts");
    const automationCommand = await readSource("src/cli/commands/automation.ts");

    expect(automationServiceIndex).not.toContain("platform/automation");
    expect(automationCommand).toContain("services/automation/index.js");
    expect(automationCommand).not.toContain("platform/automation");
    expect(automationCommand).not.toContain("platform/automation/launchd");
    expect(automationCommand).not.toContain("platform/automation/tasks");
    expect(automationCommand).not.toContain("platform/automation/legacy-hooks");
    expect(automationCommand).not.toContain("ensureAutomationSyncSince");
    expect(automationCommand).not.toContain("findNearestAlmanacDir");
    expect(automationCommand).not.toContain("writeLaunchdPlist");
    expect(automationCommand).not.toContain("bootstrapLaunchdJob");
    expect(automationCommand).not.toContain("removeLaunchdJob");
    expect(automationCommand).not.toContain("readLaunchdJobStatus");
  });

  it("keeps update command adapters out of update workflow mechanics", async () => {
    const updateCommand = await readSource("src/cli/commands/update.ts");
    const updateServiceIndex = await readSource("src/services/update/index.ts");
    const updateService = await readSource("src/services/update/update.ts");
    const updateTypes = await readSource("src/services/update/types.ts");

    expect(updateServiceIndex).not.toContain("platform/update");
    expect(updateCommand).toContain("services/update/index.js");
    expect(updateCommand).not.toContain("platform/update");
    expect(updateCommand).not.toContain("readConfig");
    expect(updateCommand).not.toContain("writeConfig");
    expect(updateCommand).not.toContain("readState");
    expect(updateCommand).not.toContain("writeState");
    expect(updateCommand).not.toContain("acquireUpdateLock");
    expect(updateCommand).not.toContain("installLatestPackage");
    expect(updateCommand).not.toContain("spawn");

    expect(updateService).not.toContain("stdout:");
    expect(updateService).not.toContain("stderr:");
    expect(updateService).not.toContain("exitCode:");
    expect(updateService).toContain("updateInstallResultFromPlatform");
    expect(updateTypes).not.toContain(
      "UpdateInstallResult = PlatformInstallLatestPackageResult",
    );
  });

  it("keeps config command adapters out of config persistence mechanics", async () => {
    const configCommand = await readSource("src/cli/commands/config.ts");

    expect(configCommand).toContain("services/config/index.js");
    expect(configCommand).not.toContain("../../config/index");
    expect(configCommand).not.toContain("node:fs");
    expect(configCommand).not.toContain("parseConfigText");
    expect(configCommand).not.toContain("readConfig(");
    expect(configCommand).not.toContain("readConfigWithOrigins(");
    expect(configCommand).not.toContain("serializeConfig");
    expect(configCommand).not.toContain("getProjectConfigPath");
    expect(existsSync(join(ROOT, "src/cli/commands/config-keys.ts"))).toBe(false);
  });

  it("keeps agents command adapters out of readiness and config mechanics", async () => {
    const agentsServiceIndex = await readSource("src/services/agents/index.ts");
    const agentsCommand = await readSource("src/cli/commands/agents.ts");

    expect(agentsServiceIndex).not.toContain("../../agent/");
    expect(agentsServiceIndex).not.toContain("../../config/");
    expect(agentsCommand).toContain("services/agents/index.js");
    expect(agentsCommand).not.toContain("agent/readiness");
    expect(agentsCommand).not.toContain("../../config/index");
    expect(agentsCommand).not.toContain("readConfig");
    expect(agentsCommand).not.toContain("writeConfig");
    expect(agentsCommand).not.toContain("parseAgentSelection");
    expect(agentsCommand).not.toContain("isAgentProviderId");
  });

  it("keeps setup agent choice UI out of readiness and config mechanics", async () => {
    const setupServiceIndex = await readSource("src/services/setup/index.ts");
    const setupAgentChoice = await readSource(
      "src/cli/commands/setup/agent-choice.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/agent-choice.ts"))).toBe(true);
    expect(setupServiceIndex).not.toContain("../../agent/");
    expect(setupServiceIndex).not.toContain("../../config/");
    expect(setupAgentChoice).toContain("services/setup/index.js");
    expect(setupAgentChoice).not.toContain("../../../agent");
    expect(setupAgentChoice).not.toContain("agent/readiness/view");
    expect(setupAgentChoice).not.toContain("../../../config/index");
    expect(setupAgentChoice).not.toContain("readConfig");
    expect(setupAgentChoice).not.toContain("writeConfig");
    expect(setupAgentChoice).not.toContain("config.agent");
    expect(setupAgentChoice).not.toContain("parseAgentSelection");
    expect(setupAgentChoice).not.toContain("isAgentProviderId");
  });

  it("keeps setup auto-commit UI out of config persistence mechanics", async () => {
    const autoCommitStep = await readSource(
      "src/cli/commands/setup/auto-commit-step.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/auto-commit.ts"))).toBe(true);
    expect(autoCommitStep).toContain("services/setup/index.js");
    expect(autoCommitStep).not.toContain("../../../config/index");
    expect(autoCommitStep).not.toContain("readConfig");
    expect(autoCommitStep).not.toContain("writeConfig");
  });

  it("keeps setup guide UI out of agent instruction install mechanics", async () => {
    const setupIndex = await readSource("src/cli/commands/setup/index.ts");
    const guidesStep = await readSource("src/cli/commands/setup/guides-step.ts");
    const guides = await readSource("src/cli/commands/setup/guides.ts");
    const targetChoice = await readSource(
      "src/cli/commands/setup/instruction-target-choice.ts",
    );

    expect(existsSync(join(ROOT, "src/services/setup/instructions.ts"))).toBe(true);
    expect(setupIndex).not.toContain("../../../agent");
    for (const source of [setupIndex, guidesStep, guides, targetChoice]) {
      expect(source).toContain("services/setup/index.js");
      expect(source).not.toContain("agent/install-targets");
      expect(source).not.toContain("agent/instructions/codex");
      expect(source).not.toContain("installAgentInstructions");
      expect(source).not.toContain("CLAUDE_IMPORT_LINE");
      expect(source).not.toContain("hasClaudeImportLine");
    }
  });

  it("keeps uninstall UI out of setup cleanup mechanics", async () => {
    const uninstallCommand = await readSource("src/cli/commands/uninstall.ts");

    expect(existsSync(join(ROOT, "src/services/setup/uninstall.ts"))).toBe(true);
    expect(uninstallCommand).toContain("services/setup/index.js");
    expect(uninstallCommand).not.toContain("agent/install-targets");
    expect(uninstallCommand).not.toContain("platform/automation/legacy-hooks");
    expect(uninstallCommand).not.toContain("runAutomationUninstall");
    expect(uninstallCommand).not.toContain("removeAgentInstructions");
    expect(uninstallCommand).not.toContain("cleanupLegacyHooks");
  });

  it("keeps setup cleanup services behind automation service cleanup verbs", async () => {
    const setupUninstall = await readSource("src/services/setup/uninstall.ts");

    expect(setupUninstall).toContain("cleanupLegacyAutomationHooks");
    expect(setupUninstall).not.toContain("platform/automation");
  });

  it("keeps sync command adapters out of transcript and absorb workflow mechanics", async () => {
    const syncServiceIndex = await readSource("src/services/sync/index.ts");
    const syncService = await readSource("src/services/sync/sync.ts");
    const syncCommand = await readSource("src/cli/commands/sync.ts");

    expect(syncServiceIndex).not.toContain("../../sync");
    expect(syncService).not.toContain("export type SyncWorkflowSummary = sync.SyncSummary");
    expect(syncService).toContain("syncWorkflowSummaryFromSweep");
    expect(syncCommand).toContain("services/sync/index.js");
    expect(syncCommand).not.toContain("../../sync");
    expect(syncCommand).not.toContain("../../operations");
    expect(syncCommand).not.toContain("readConfig");
    expect(syncCommand).not.toContain("parseDuration");
    expect(syncCommand).not.toContain("homedir");
    expect(syncCommand).not.toContain("discoverCandidates");
    expect(syncCommand).not.toContain("providerForRepo");
    expect(syncCommand).not.toContain("syncAbsorbContext");
  });

  it("keeps lifecycle operation command adapters out of run-start mechanics", async () => {
    const lifecycleServiceIndex = await readSource("src/services/lifecycle/index.ts");
    const operationsCommand = await readSource("src/cli/commands/operations.ts");

    expect(lifecycleServiceIndex).not.toContain("../../operations");
    expect(operationsCommand).toContain("services/lifecycle/index.js");
    expect(operationsCommand).not.toContain("../../operations/index");
    expect(operationsCommand).not.toContain("../../absorb");
    expect(operationsCommand).not.toContain("resolveProvider");
    expect(operationsCommand).not.toContain("operations.build");
    expect(operationsCommand).not.toContain("operations.garden");
    expect(operationsCommand).not.toContain("absorb.startRun");
    expect(operationsCommand).not.toContain("initContext");
  });

  it("keeps Claude provider protocol mechanics in provider-local modules", async () => {
    const claudeProvider = await readSource("src/harness/providers/claude.ts");

    expect(existsSync(join(ROOT, "src/harness/providers/claude/options.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/harness/providers/claude/events.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/harness/providers/claude/failures.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/harness/providers/claude/usage.ts"))).toBe(true);
    expect(claudeProvider).not.toContain("spawnManagedChildProcess");
    expect(claudeProvider).not.toContain("function buildClaudeOptions");
    expect(claudeProvider).not.toContain("function toClaudeHarnessEvents");
    expect(claudeProvider).not.toContain("function classifyClaudeFailure");
    expect(claudeProvider).not.toContain("function mapClaudeUsage");
  });

  it("keeps Codex app-server policy out of the JSON-RPC run loop", async () => {
    const appServer = await readSource("src/harness/providers/codex/app-server.ts");

    expect(existsSync(join(ROOT, "src/harness/providers/codex/app-server-config.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/harness/providers/codex/server-requests.ts"))).toBe(true);
    expect(appServer).not.toContain("CODEALMANAC_CODEX_APP_SERVER");
    expect(appServer).not.toContain("function parsePositiveEnvInt");
    expect(appServer).not.toContain("case \"item/commandExecution/requestApproval\"");
    expect(appServer).not.toContain("case \"account/chatgptAuthTokens/refresh\"");
  });

  it("keeps migrate legacy-sources adapter out of source migration mechanics", async () => {
    const migrateCommand = await readSource("src/cli/commands/migrate.ts");
    const sourceMigrationService = await readSource(
      "src/services/wiki/source-migration.ts",
    );
    const wikiSources = await readSource("src/wiki/sources/index.ts");
    const wikiSourcesMaintenance = await readSource(
      "src/wiki/sources/maintenance.ts",
    );

    expect(migrateCommand).toContain("services/wiki/source-migration.js");
    expect(migrateCommand).toContain("services/automation/index.js");
    expect(migrateCommand).not.toContain("wiki/indexer");
    expect(migrateCommand).not.toContain("wiki/sources");
    expect(migrateCommand).not.toContain("platform/automation");
    expect(migrateCommand).not.toContain("./automation.js");
    expect(migrateCommand).not.toContain("resolveWikiRoot");
    expect(migrateCommand).not.toContain("migrateLegacySourceFrontmatter");
    expect(migrateCommand).not.toContain("detectLegacyCaptureSweepAutomation");
    expect(migrateCommand).not.toContain("removeLaunchdJob");
    expect(migrateCommand).not.toContain("runAutomationInstall");
    expect(sourceMigrationService).not.toContain(
      "export type MigrateLegacySourcesResult = LegacySourceMigrationResult",
    );
    expect(wikiSources).not.toContain("MigrateLegacySources");
    expect(wikiSourcesMaintenance).not.toContain("MigrateLegacySources");
  });

  it("keeps automation command options owned by the command adapter", async () => {
    const automationCommand = await readSource("src/cli/commands/automation.ts");

    expect(automationCommand).toContain("AutomationInstallCommandOptions");
    expect(automationCommand).toContain("toAutomationInstallOptions");
    expect(automationCommand).not.toContain(
      "AutomationOptions = AutomationInstallOptions & AutomationUninstallOptions",
    );
    expect(automationCommand).not.toContain("export type { AutomationStatusOptions }");
  });

  it("keeps doctor diagnostics out of the CLI command package", async () => {
    const doctorIndex = await readSource("src/cli/commands/doctor/index.ts");
    const doctorDiagnostics = await readSource("src/services/diagnostics/doctor.ts");
    const diagnosticsTypes = await readSource("src/services/diagnostics/types.ts");
    const diagnosticsIndex = await readSource("src/services/diagnostics/index.ts");
    const doctorService = await readSource("src/services/wiki/doctor.ts");

    expect(doctorIndex).toContain("services/diagnostics/index.js");
    expect(doctorIndex).not.toContain("./install.js");
    expect(doctorIndex).not.toContain("./agents.js");
    expect(doctorIndex).not.toContain("./updates.js");
    expect(doctorIndex).not.toContain("./probes.js");
    expect(doctorIndex).not.toContain("agent/");
    expect(doctorIndex).not.toContain("platform/");
    expect(doctorIndex).not.toContain("readConfig");
    expect(doctorIndex).not.toContain("readStateForDoctor");
    expect(diagnosticsTypes).not.toContain("agent/readiness/providers/claude");
    expect(diagnosticsIndex).not.toContain("../../agent/");
    expect(diagnosticsIndex).not.toContain("../../config/");
    expect(doctorDiagnostics).toContain("../wiki/doctor.js");
    expect(existsSync(join(ROOT, "src/services/diagnostics/doctor.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/install.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/agents.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/updates.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/probes.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/types.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/wiki.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/cli/commands/doctor/duration.ts"))).toBe(false);

    expect(doctorService).not.toContain("readdirSync");
    expect(doctorService).not.toContain("statSync");
    expect(doctorService).not.toContain("openIndex");
    expect(doctorService).not.toContain("findEntry");
    expect(doctorService).not.toContain("collectHealthReport");
  });

  it("keeps registry persistence in an explicit store", () => {
    expect(existsSync(join(ROOT, "src/stores/wiki-registry/store.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/wiki/registry/store.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/wiki/registry/index.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/wiki/registry"))).toBe(false);
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}
