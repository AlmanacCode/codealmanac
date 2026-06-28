import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: automation, update, config, and agents", () => {
  it("keeps automation command adapters out of launchd workflow mechanics", async () => {
    const automationServiceIndex = await readSource("src/services/automation/index.ts");
    const automationServiceTypes = await readSource("src/services/automation/types.ts");
    const automationPlanning = await readSource("src/services/automation/planning.ts");
    const automationJobPlanning = await readSource("src/services/automation/job-planning.ts");
    const automationTaskSchedule = await readSource("src/services/automation/task-schedule.ts");
    const automationTaskSelection = await readSource("src/services/automation/task-selection.ts");
    const automationWorkflow = await readSource("src/services/automation/automation.ts");
    const automationMigration = await readSource("src/services/automation/migration.ts");
    const automationCatalog = await readSource("src/services/automation/catalog.ts");
    const automationLegacyHooks = await readSource("src/services/automation/legacy-hooks.ts");
    const automationTasks = await readSource("src/services/automation/tasks.ts");
    const automationScheduler = await readSource("src/shared/automation-scheduler.ts");
    const automationAppRuntime = await readSource("src/app/automation-runtime.ts");
    const automationRegistration = await readSource("src/edges/cli/register-automation-commands.ts");
    const automationInstallRegistration = await readSource(
      "src/edges/cli/register-automation-install-command.ts",
    );
    const automationUninstallRegistration = await readSource(
      "src/edges/cli/register-automation-uninstall-command.ts",
    );
    const automationStatusRegistration = await readSource(
      "src/edges/cli/register-automation-status-command.ts",
    );
    const automationTaskInput = await readSource(
      "src/edges/cli/automation-task-input.ts",
    );
    const migrateRegistration = await readSource("src/edges/cli/register-migrate-commands.ts");
    const setupAutomationStep = await readSource("src/edges/cli/setup/automation-step.ts");
    const setupAutoUpdateStep = await readSource("src/edges/cli/setup/auto-update-step.ts");
    const uninstallEdge = await readSource("src/edges/cli/uninstall.ts");
    const launchdAutomationScheduler = await readSource("src/platform/automation/scheduler.ts");
    const automationPaths = await readSource("src/platform/automation/paths.ts");
    const automationInstallCommand = await readSource(
      "src/edges/cli/commands/automation/install.ts",
    );
    const automationUninstallCommand = await readSource(
      "src/edges/cli/commands/automation/uninstall.ts",
    );
    const automationStatusCommand = await readSource(
      "src/edges/cli/commands/automation/status.ts",
    );
    const automationRender = await readSource(
      "src/edges/cli/commands/automation/render.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation-render.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation/install.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation/uninstall.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation/status.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation/render.ts")))
      .toBe(true);
    expect(automationServiceIndex).not.toContain("platform/automation");
    expect(automationServiceTypes).not.toContain("platform/automation");
    expect(automationServiceTypes).toContain("shared/automation-scheduler.js");
    expect(automationServiceTypes).not.toContain("PlatformExecFn");
    expect(automationServiceTypes).not.toContain("PlatformScheduledTaskId");
    expect(automationServiceTypes).not.toContain("NodeJS.ProcessEnv");
    expect(automationServiceTypes).toContain("homeDir: string");
    expect(automationPlanning).not.toContain("process.cwd()");
    expect(automationPlanning).not.toContain("process.env");
    expect(automationPlanning).not.toContain("homedir");
    expect(automationPlanning).not.toContain("node:path");
    expect(automationPlanning).not.toContain("findNearestAlmanacDir");
    expect(automationPlanning).not.toContain("resolveNearestWikiRootOrCwd");
    expect(automationPlanning).not.toContain("parseDuration");
    expect(automationPlanning).not.toContain("syncProgramArguments");
    expect(automationPlanning).toContain("selectAutomationInstallTasks");
    expect(automationPlanning).toContain("resolveAutomationTaskSchedule");
    expect(automationPlanning).toContain("buildAutomationSchedulerJob");
    expect(automationJobPlanning).toContain("resolveNearestWikiRootOrCwd");
    expect(automationJobPlanning).toContain("syncProgramArguments");
    expect(automationTaskSchedule).toContain("parseDuration");
    expect(automationTaskSchedule).not.toContain("scheduler.buildJob");
    expect(automationTaskSelection).toContain("selectedTaskIds");
    expect(automationTaskSelection).not.toContain("parseDuration");
    expect(automationTaskSelection).not.toContain("scheduler.buildJob");
    expect(automationPlanning).not.toContain("platform/automation/tasks");
    expect(automationPlanning).not.toContain("platform/automation/launchd");
    expect(automationPlanning).not.toContain("platform/automation/paths");
    expect(automationPlanning).not.toContain("buildLaunchPath");
    expect(automationPlanning).not.toContain("automationLogPaths");
    expect(automationPlanning).not.toContain("launchAgentPlistPath");
    expect(automationPlanning).not.toContain("LaunchdJobDefinition");
    expect(automationWorkflow).not.toContain("platform/automation");
    expect(automationMigration).not.toContain("platform/automation");
    expect(automationWorkflow).not.toContain("homedir");
    expect(automationWorkflow).not.toContain("existsSync");
    expect(automationMigration).not.toContain("homedir");
    expect(automationMigration).not.toContain("readProgramArgumentAfter");
    expect(automationMigration).not.toContain("removeLaunchdJob");
    expect(automationCatalog).not.toContain("homedir");
    expect(automationLegacyHooks).not.toContain("platform/automation");
    expect(automationLegacyHooks).not.toContain("homeDir?: string");
    expect(automationLegacyHooks).not.toContain("= {}");
    expect(automationTasks).not.toContain("process.argv");
    expect(automationTasks).not.toContain("process.cwd()");
    expect(automationTasks).not.toContain("process.execPath");
    expect(automationTasks).not.toContain("task.programArguments");
    expect(automationTasks).not.toContain("LaunchAgents");
    expect(automationTasks).not.toContain("path.join");
    expect(automationTasks).toContain("automationTaskDefinition");
    expect(automationPaths).toContain("LaunchAgents");
    expect(automationPaths).toContain("launchAgentPlistPath");
    expect(existsSync(join(ROOT, "src/services/automation/scheduler.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/automation-scheduler.ts"))).toBe(true);
    expect(automationScheduler).toContain("export interface AutomationScheduler");
    expect(automationScheduler).not.toContain("AutomationTaskId");
    expect(automationScheduler).not.toContain("taskId");
    expect(automationScheduler).toContain("programArguments: string[] | null");
    expect(existsSync(join(ROOT, "src/app/automation-runtime.ts"))).toBe(true);
    expect(automationAppRuntime).toContain("createLaunchdAutomationScheduler");
    expect(automationRegistration).toContain("registerAutomationInstallCommand(automation)");
    expect(automationRegistration).toContain("registerAutomationUninstallCommand(automation)");
    expect(automationRegistration).toContain("registerAutomationStatusCommand(automation)");
    expect(automationRegistration).not.toContain("createAutomationScheduler");
    expect(automationRegistration).not.toContain("parseAutomationTaskIds");
    expect(automationInstallRegistration).toContain("createAutomationScheduler");
    expect(automationInstallRegistration).toContain("currentCliProgramArguments");
    expect(automationUninstallRegistration).toContain("createAutomationScheduler");
    expect(automationStatusRegistration).toContain("createAutomationScheduler");
    expect(automationTaskInput).toContain("parseAutomationTaskIds");
    for (const source of [
      automationInstallRegistration,
      automationUninstallRegistration,
      automationStatusRegistration,
      migrateRegistration,
      setupAutomationStep,
      setupAutoUpdateStep,
      uninstallEdge,
    ]) {
      expect(source).toContain("createAutomationScheduler");
      expect(source).not.toContain("platform/automation/scheduler");
      expect(source).not.toContain("createLaunchdAutomationScheduler");
    }
    expect(launchdAutomationScheduler).toContain("createLaunchdAutomationScheduler");
    expect(launchdAutomationScheduler).toContain("shared/automation-scheduler.js");
    expect(launchdAutomationScheduler).not.toContain("services/automation");
    expect(launchdAutomationScheduler).not.toContain("taskId");
    expect(launchdAutomationScheduler).toContain("buildLaunchPath");
    expect(launchdAutomationScheduler).toContain("automationLogPaths");
    expect(launchdAutomationScheduler).toContain("launchAgentPlistPath");
    expect(launchdAutomationScheduler).toContain("readLaunchdProgramArguments");
    expect(existsSync(join(ROOT, "src/platform/automation/job-plan.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/platform/automation/tasks.ts"))).toBe(false);
    for (const automationCommand of [
      automationInstallCommand,
      automationUninstallCommand,
      automationStatusCommand,
    ]) {
      expect(automationCommand).toContain("services/automation/index.js");
      expect(automationCommand).not.toContain("import type { CommandResult }");
      expect(automationCommand).toContain("AutomationCommandResult");
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
      expect(automationCommand).not.toContain("TASK_LABELS");
      expect(automationCommand).not.toContain("formatAutomationStatusSection");
      expect(automationCommand).not.toContain("defaultPlistPath");
      expect(automationCommand).not.toContain("automation installed");
      expect(automationCommand).not.toContain("legacy automation");
    }
    expect(automationServiceIndex).not.toContain("defaultSyncAutomationPlistPath");
    expect(automationRender).toContain("renderAutomationInstallResult");
    expect(automationRender).toContain("formatAutomationStatusSection");
  });

  it("keeps update command adapters out of update workflow mechanics", async () => {
    const updateCommand = await readSource("src/edges/cli/commands/update.ts");
    const updateRender = await readSource("src/edges/cli/commands/update-render.ts");
    const updateServiceIndex = await readSource("src/services/update/index.ts");
    const updateService = await readSource("src/services/update/update.ts");
    const updateServiceCheck = await readSource("src/services/update/check.ts");
    const updateTypes = await readSource("src/services/update/types.ts");
    const sharedUpdateRuntime = await readSource("src/shared/update-runtime.ts");
    const updateInstall = await readSource("src/platform/update/install.ts");
    const updateRuntime = await readSource("src/app/update-runtime.ts");
    const updateCheck = await readSource("src/platform/update/check.ts");
    const updateAnnounce = await readSource("src/edges/cli/update-announcement.ts");
    const updateNotifier = await readSource("src/services/update/notifier.ts");
    const updateNotifierWorker = await readSource(
      "src/platform/update/notifier-worker.ts",
    );
    const updateStoreIndex = await readSource("src/stores/update/index.ts");
    const updateStateStore = await readSource("src/stores/update/state.ts");
    const updateLockStore = await readSource("src/stores/update/lock.ts");
    const updateRegistration = await readSource("src/edges/cli/register-update-command.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/update-render.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/update/state.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/update/lock.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/update-runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/update-runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/update/check.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/update/notifier.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/update-announcement.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/update-check-scheduler.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/platform/update/announce.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/platform/update/runtime.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/platform/update/state.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/platform/update/lock.ts"))).toBe(false);
    expect(updateServiceIndex).not.toContain("platform/update");
    expect(updateServiceIndex).toContain("./check.js");
    expect(updateServiceIndex).toContain("./notifier.js");
    expect(updateCommand).toContain("services/update/index.js");
    expect(updateCommand).toContain("./update-render.js");
    expect(updateCommand).not.toContain("platform/update");
    expect(updateCommand).not.toContain("readConfig");
    expect(updateCommand).not.toContain("writeConfig");
    expect(updateCommand).not.toContain("readState");
    expect(updateCommand).not.toContain("writeState");
    expect(updateCommand).not.toContain("acquireUpdateLock");
    expect(updateCommand).not.toContain("installLatestPackage");
    expect(updateCommand).not.toContain("spawn");
    expect(updateCommand).not.toContain("stdout:");
    expect(updateCommand).not.toContain("stderr:");
    expect(updateCommand).not.toContain("exitCode:");
    expect(updateCommand).not.toContain("registry.npmjs.org");
    expect(updateCommand).not.toContain("already dismissed");
    expect(updateCommand).not.toContain("update notifier enabled");
    expect(updateCommand).not.toContain("install-result");

    expect(updateRender).toContain("renderUpdateResult");
    expect(updateRender).toContain("renderNotifierUpdated");
    expect(updateRender).toContain("registryFailureSuffix");

    expect(updateService).not.toContain("stdout:");
    expect(updateService).not.toContain("stderr:");
    expect(updateService).not.toContain("exitCode:");
    expect(updateService).not.toContain("node:child_process");
    expect(updateService).not.toContain("platform/update");
    expect(updateService).not.toContain("platform/update/state");
    expect(updateService).not.toContain("platform/update/lock");
    expect(updateService).toContain("stores/update/index.js");
    expect(updateService).toContain("opts.runtime.readInstalledVersion()");
    expect(updateService).toContain("opts.runtime.checkForUpdate");
    expect(updateService).toContain("opts.runtime.installLatestPackage()");
    expect(updateService).not.toContain("updateInstallResultFromPlatform");
    expect(updateServiceCheck).toContain("stores/update/index.js");
    expect(updateServiceCheck).toContain("fetchLatestVersion");
    expect(updateServiceCheck).not.toContain("globalThis.fetch");
    expect(updateServiceCheck).not.toContain("registry.npmjs.org");
    expect(updateServiceCheck).not.toContain("platform/update");
    expect(updateNotifier).toContain("readUpdateAnnouncement");
    expect(updateNotifier).toContain("readUpdateNotifierEnabled");
    expect(updateNotifier).toContain("shouldScheduleUpdateCheck");
    expect(updateNotifier).toContain("stores/config/index.js");
    expect(updateNotifier).toContain("stores/update/index.js");
    expect(updateNotifier).not.toContain("platform/update");
    expect(updateTypes).not.toContain(
      "UpdateInstallResult = PlatformInstallLatestPackageResult",
    );
    expect(updateTypes).not.toContain("typeof platformCheckForUpdate");
    expect(updateTypes).not.toContain("typeof nodeSpawn");
    expect(updateTypes).not.toContain("UpdateInstallSpawnFn");
    expect(updateTypes).not.toContain("SpawnOptions");
    expect(updateTypes).not.toContain("node:child_process");
    expect(updateTypes).toContain("UpdateInstallFn");
    expect(updateTypes).toContain("UpdateRuntime");
    expect(updateTypes).toContain("runtime: UpdateRuntime");
    expect(updateTypes).toContain("pid?: number");
    expect(updateTypes).not.toContain("platform/update/check");
    expect(sharedUpdateRuntime).toContain("export interface UpdateRuntime");
    expect(sharedUpdateRuntime).toContain("UpdateLatestVersionResult");
    expect(updateInstall).toContain("node:child_process");
    expect(updateInstall).toContain("spawnFn");
    expect(updateRuntime).toContain("createUpdateRuntime");
    expect(updateRuntime).toContain("checkForUpdate");
    expect(updateRuntime).toContain("fetchLatestVersion");
    expect(updateRuntime).toContain("installLatestPackage");
    expect(updateRuntime).toContain("readInstalledVersion");
    expect(updateRuntime).toContain("updateInstallResultFromPlatform");
    expect(updateCheck).toContain("globalThis.fetch");
    expect(updateCheck).toContain("registry.npmjs.org/codealmanac");
    expect(updateCheck).not.toContain("stores/update");
    expect(updateCheck).not.toContain("services/update");
    expect(updateAnnounce).toContain("readUpdateAnnouncement");
    expect(updateAnnounce).toContain("makeAnsiTheme");
    expect(updateAnnounce).toContain("installedVersion: string");
    expect(updateAnnounce).not.toContain("platform/update");
    expect(updateAnnounce).not.toContain("readInstalledVersion");
    expect(updateAnnounce).not.toContain("stores/update");
    expect(updateAnnounce).not.toContain("stores/config");
    expect(updateNotifierWorker).toContain("spawnBackgroundUpdateCheck");
    expect(updateNotifierWorker).toContain("node:child_process");
    expect(updateNotifierWorker).not.toContain("stores/config");
    expect(updateNotifierWorker).not.toContain("readFileSync");
    expect(updateStoreIndex).toContain("readStateSync");
    expect(updateStateStore).toContain("readFileSync");
    expect(updateLockStore).toContain("pid: number");
    expect(updateLockStore).toContain("pid: options.pid");
    expect(updateLockStore).not.toContain("process.pid");
    expect(updateRegistration).toContain("createUpdateRuntime");
    expect(updateRegistration).toContain("runtime: createUpdateRuntime()");
    expect(updateRegistration).toContain("pid: process.pid");
  });

  it("keeps config command adapters out of config persistence mechanics", async () => {
    const configCommand = await readSource("src/edges/cli/commands/config.ts");
    const configRender = await readSource("src/edges/cli/commands/config-render.ts");
    const configServiceIndex = await readSource("src/services/config/index.ts");
    const configReadService = await readSource("src/services/config/config-read.ts");
    const configWriteService = await readSource("src/services/config/config-write.ts");
    const configTypes = await readSource("src/services/config/config-types.ts");
    const configStore = await readSource("src/stores/config/store.ts");
    const configPatch = await readSource("src/stores/config/stored-patch.ts");
    const configIndex = await readSource("src/stores/config/index.ts");

    expect(existsSync(join(ROOT, "src/config"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/config/config.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/config/config-read.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/services/config/config-write.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/services/config/config-types.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/config-render.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/stores/config/stored-patch.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/agent-provider-enablement.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/agent/provider-enablement.ts"))).toBe(
      false,
    );
    expect(configCommand).toContain("services/config/index.js");
    expect(configCommand).not.toContain("../../config/index");
    expect(configCommand).not.toContain("node:fs");
    expect(configCommand).not.toContain("parseConfigText");
    expect(configCommand).not.toContain("readConfig(");
    expect(configCommand).not.toContain("readConfigWithOrigins(");
    expect(configCommand).not.toContain("serializeConfig");
    expect(configCommand).not.toContain("getProjectConfigPath");
    expect(configCommand).not.toContain("process.cwd()");
    expect(configCommand).not.toContain("parseConfigKey");
    expect(configCommand).not.toContain("formatTextTable");
    expect(configCommand).not.toContain("JSON.stringify");
    expect(configCommand).not.toContain("formatConfigValue");
    expect(configCommand).not.toContain("unknown config key");
    expect(configCommand).not.toContain("missing value");
    expect(configCommand).not.toContain("no .almanac/ found");
    expect(configCommand).toContain("readConfigEntryByKey");
    expect(configCommand).toContain("setConfigEntryByKey");
    expect(configCommand).toContain("unsetConfigEntryByKey");
    expect(configServiceIndex).not.toContain("./config.js");
    expect(configServiceIndex).toContain("config-read.js");
    expect(configServiceIndex).toContain("config-write.js");
    expect(configServiceIndex).toContain("config-types.js");
    expect(configReadService).toContain("readConfigWithOrigins");
    expect(configReadService).toContain("listConfigEntries");
    expect(configReadService).toContain("readConfigEntryByKey");
    expect(configReadService).not.toContain("writeConfigObject");
    expect(configReadService).not.toContain("setNestedConfigValue");
    expect(configWriteService).toContain("writeConfigObject");
    expect(configWriteService).toContain("setNestedConfigValue");
    expect(configWriteService).toContain("deleteNestedConfigValue");
    expect(configWriteService).not.toContain("readConfigWithOrigins");
    expect(configTypes).not.toContain("readConfigWithOrigins");
    expect(configTypes).not.toContain("writeConfigObject");
    expect(configTypes).toContain("ConfigSetResult");
    expect(configTypes).toContain("ConfigUnsetResult");
    expect(configRender).toContain("unknown config key");
    expect(configRender).toContain("missing value");
    expect(configRender).toContain("formatTextTable");
    expect(configRender).toContain("renderConfigList");
    expect(configRender).toContain("renderConfigSet");
    expect(existsSync(join(ROOT, "src/edges/cli/commands/config-keys.ts"))).toBe(false);
    expect(configStore).not.toContain("function toStoredConfigPatch");
    expect(configStore).not.toContain("function setStoredValue");
    expect(configStore).not.toContain("function pruneEmptyObjects");
    expect(configPatch).toContain("toStoredConfigPatch");
    expect(configPatch).toContain("pruneEmptyObjects");
    expect(configIndex).not.toContain("getEnabledAgentProviderIds");
    expect(configIndex).not.toContain("isEnabledAgentProviderId");
    expect(configIndex).not.toContain("disabledAgentProviderMessage");
  });

  it("keeps agents command adapters out of readiness and config mechanics", async () => {
    const agentsServiceIndex = await readSource("src/services/agents/index.ts");
    const agentsViewService = await readSource("src/services/agents/agents-view.ts");
    const agentDefaultService = await readSource("src/services/agents/agent-default.ts");
    const agentModelService = await readSource("src/services/agents/agent-model.ts");
    const agentConfigWrite = await readSource(
      "src/services/agents/agent-config-write.ts",
    );
    const agentsReadCommand = await readSource(
      "src/edges/cli/commands/agents/read.ts",
    );
    const agentsDefaultCommand = await readSource(
      "src/edges/cli/commands/agents/default.ts",
    );
    const agentsModelCommand = await readSource(
      "src/edges/cli/commands/agents/model.ts",
    );
    const agentsRender = await readSource("src/edges/cli/commands/agents/render.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/agents.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/agents-render.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/agents/read.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/agents/default.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/agents/model.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/agents/render.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/agents/agents.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/agents/agents-view.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/services/agents/agent-default.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/services/agents/agent-model.ts"))).toBe(
      true,
    );
    expect(agentsServiceIndex).not.toContain("../../agent/");
    expect(agentsServiceIndex).not.toContain("../../config/");
    expect(agentsServiceIndex).not.toContain("./agents.js");
    expect(agentsViewService).not.toContain("AgentsProviderReadiness = ProviderReadiness");
    expect(agentsViewService).not.toContain("AgentsProviderView = ProviderSetupView");
    expect(agentsViewService).not.toContain("AgentsAgentProviderId = AgentProviderId");
    expect(agentsViewService).toContain("agentsProviderViewFromSetupView");
    expect(agentsViewService).not.toContain("setConfigEntry");
    expect(agentsViewService).not.toContain("parseAgentSelection");
    expect(agentDefaultService).toContain("parseAgentSelection");
    expect(agentDefaultService).not.toContain("buildProviderSetupView");
    expect(agentDefaultService).not.toContain("isAgentProviderId");
    expect(agentModelService).toContain("isAgentProviderId");
    expect(agentModelService).not.toContain("buildProviderSetupView");
    expect(agentModelService).not.toContain("parseAgentSelection");
    expect(agentConfigWrite).toContain("setConfigEntry");
    expect(agentConfigWrite).not.toContain("parseAgentSelection");
    expect(agentConfigWrite).not.toContain("isAgentProviderId");
    for (const agentsCommand of [
      agentsReadCommand,
      agentsDefaultCommand,
      agentsModelCommand,
    ]) {
      expect(agentsCommand).toContain("services/agents/index.js");
      expect(agentsCommand).not.toContain("agent/readiness");
      expect(agentsCommand).not.toContain("../../config/index");
      expect(agentsCommand).not.toContain("process.cwd()");
      expect(agentsCommand).not.toContain("readConfig");
      expect(agentsCommand).not.toContain("writeConfig");
      expect(agentsCommand).not.toContain("parseAgentSelection");
      expect(agentsCommand).not.toContain("isAgentProviderId");
      expect(agentsCommand).not.toContain("formatTextTable");
      expect(agentsCommand).not.toContain("readinessLabel");
      expect(agentsCommand).not.toContain("unknown agent");
      expect(agentsCommand).not.toContain("missing model");
      expect(agentsCommand).not.toContain("runSetDefaultAgent");
      expect(agentsCommand).not.toContain("runSetAgentModel");
    }
    expect(agentsReadCommand).toContain("runAgentsList");
    expect(agentsReadCommand).toContain("runAgentsDoctor");
    expect(agentsDefaultCommand).toContain("runAgentsUse");
    expect(agentsModelCommand).toContain("runAgentsModel");
    expect(agentsRender).toContain("renderAgentsList");
    expect(agentsRender).toContain("renderAgentsDoctor");
    expect(agentsRender).toContain("renderSetDefaultAgentResult");
    expect(agentsRender).toContain("renderSetAgentModelResult");
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}
