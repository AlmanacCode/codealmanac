import { ensureAutomationSyncSince } from "../../stores/config/index.js";
import {
  automationTaskDefinition,
} from "./tasks.js";
import {
  buildAutomationInstallPlan,
  type AutomationInstallPlan,
  plistPathForTask,
  selectedTaskIds,
} from "./planning.js";
import type {
  AutomationInstallOptions,
  AutomationInstallResult,
  AutomationStatusOptions,
  AutomationStatusResult,
  AutomationUninstallOptions,
  AutomationUninstallResult,
  InstalledAutomationTask,
} from "./types.js";

export async function installAutomation(
  options: AutomationInstallOptions,
): Promise<AutomationInstallResult> {
  const plan = buildAutomationInstallPlan(options, options.scheduler);
  if (!plan.ok) return { status: "invalid", error: plan.error };

  await options.scheduler.writeJobs(plan.value.jobs.map((job) => job.job));

  const syncJob = plan.value.jobs.find((job) => job.task.id === "sync");
  const syncSince = syncJob === undefined
    ? null
    : await ensureAutomationSyncSince(
      (options.now ?? new Date()).toISOString(),
      options.configPath,
    );

  const activated = await activateAutomationJobs(plan.value, options);
  if (activated.status === "activation-failed") return activated;
  return {
    status: "installed",
    tasks: installedTasks(plan.value),
    gardenDisabled: plan.value.disabledGardenPlistPath !== null,
    syncSince,
  };
}

export async function uninstallAutomation(
  options: AutomationUninstallOptions,
): Promise<AutomationUninstallResult> {
  const home = options.homeDir;
  const tasks = selectedTaskIds(options.tasks, false);
  const removed: string[] = [];

  for (const task of tasks.map((id) => automationTaskDefinition(id))) {
    const plist = plistPathForTask(task, home, options, options.scheduler);
    if (await options.scheduler.removeJob(plist)) {
      removed.push(plist);
    }
  }

  return removed.length > 0
    ? { status: "removed", plistPaths: removed }
    : { status: "not-installed" };
}

export async function readAutomationStatus(
  options: AutomationStatusOptions,
): Promise<AutomationStatusResult> {
  const home = options.homeDir;
  const tasks = selectedTaskIds(options.tasks, false);
  const sections: AutomationStatusResult["sections"] = [];
  const legacy = tasks.includes("sync")
    ? await options.scheduler.detectLegacyCaptureSweep({
      homeDir: home,
      plistPath: options.legacyCapturePlistPath,
    })
    : null;

  for (const task of tasks.map((id) => automationTaskDefinition(id))) {
    const status = await options.scheduler.readJobStatus({
      label: task.label,
      plistPath: plistPathForTask(task, home, options, options.scheduler),
    });
    sections.push({
      status: "task",
      taskId: task.id,
      installed: status.installed,
      plistPath: status.plistPath,
      loaded: status.loaded,
      intervalSeconds: status.intervalSeconds,
      quiet: task.id === "sync" && status.programArguments !== null
        ? readArgument(status.programArguments, "--quiet")
        : null,
    });
    if (task.id === "sync" && legacy !== null) {
      sections.push({ status: "legacy-capture", plistPath: legacy.plistPath });
    }
  }

  return { status: "checked", sections };
}

async function activateAutomationJobs(
  plan: AutomationInstallPlan,
  options: AutomationInstallOptions,
): Promise<{ status: "activated" } | Extract<AutomationInstallResult, { status: "activation-failed" }>> {
  for (const planned of plan.jobs) {
    try {
      await options.scheduler.activateJob(planned.job);
    } catch (err: unknown) {
      return {
        status: "activation-failed",
        taskId: planned.task.id,
        plistPath: planned.job.plistPath,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
  if (plan.disabledGardenPlistPath !== null) {
    await options.scheduler.removeJob(plan.disabledGardenPlistPath);
  }
  return { status: "activated" };
}

function installedTasks(plan: AutomationInstallPlan): InstalledAutomationTask[] {
  return plan.jobs.map((planned) => ({
    taskId: planned.task.id,
    intervalInput: planned.intervalInput,
    command: planned.job.programArguments,
    plistPath: planned.job.plistPath,
    quiet: planned.task.id === "sync" ? readArgument(planned.job.programArguments, "--quiet") : null,
  }));
}

function readArgument(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);
  if (index < 0) return null;
  return args[index + 1] ?? null;
}
