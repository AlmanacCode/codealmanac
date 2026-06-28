import { ensureAutomationSyncSince } from "../../stores/config/index.js";
import {
  bootstrapLaunchdJob,
  ensureLaunchdDirs,
  readProgramArgumentAfter,
  readLaunchdJobStatus,
  removeLaunchdJob,
  writeLaunchdPlist,
} from "../../platform/automation/launchd.js";
import { detectLegacyCaptureSweepAutomation } from "../../platform/automation/legacy-capture.js";
import {
  scheduledTaskDefinition,
} from "../../platform/automation/tasks.js";
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
  const plan = buildAutomationInstallPlan(options);
  if (!plan.ok) return { status: "invalid", error: plan.error };

  await writeAutomationPlists(plan.value);

  const syncJob = plan.value.jobs.find((job) => job.task.id === "sync");
  const syncSince = syncJob === undefined
    ? null
    : await ensureAutomationSyncSince(
      (options.now ?? new Date()).toISOString(),
      options.configPath,
    );

  const activated = await activateAutomationJobs(plan.value, options.exec);
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

  for (const task of tasks.map((id) => scheduledTaskDefinition(id))) {
    const plist = plistPathForTask(task, home, options);
    if (await removeLaunchdJob(plist, options.exec)) {
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
    ? await detectLegacyCaptureSweepAutomation({
      homeDir: home,
      plistPath: options.legacyCapturePlistPath,
    })
    : null;

  for (const task of tasks.map((id) => scheduledTaskDefinition(id))) {
    const status = await readLaunchdJobStatus({
      label: task.label,
      plistPath: plistPathForTask(task, home, options),
      exec: options.exec,
    });
    sections.push({
      status: "task",
      taskId: task.id,
      installed: status.contents !== null,
      plistPath: status.plistPath,
      loaded: status.loaded,
      intervalSeconds: status.intervalSeconds,
      quiet: task.id === "sync" && status.contents !== null
        ? readProgramArgumentAfter(status.contents, "--quiet")
        : null,
    });
    if (task.id === "sync" && legacy !== null) {
      sections.push({ status: "legacy-capture", plistPath: legacy.plistPath });
    }
  }

  return { status: "checked", sections };
}

async function writeAutomationPlists(plan: AutomationInstallPlan): Promise<void> {
  const jobs = plan.jobs.map((job) => job.job);
  await ensureLaunchdDirs(jobs);
  await Promise.all(jobs.map((job) => writeLaunchdPlist(job)));
}

async function activateAutomationJobs(
  plan: AutomationInstallPlan,
  exec: AutomationInstallOptions["exec"],
): Promise<{ status: "activated" } | Extract<AutomationInstallResult, { status: "activation-failed" }>> {
  for (const planned of plan.jobs) {
    try {
      await bootstrapLaunchdJob(planned.job.plistPath, exec);
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
    await removeLaunchdJob(plan.disabledGardenPlistPath, exec);
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
