import {
  bootstrapLaunchdJob,
  buildLaunchPath,
  ensureLaunchdDirs,
  readLaunchdJobStatus,
  removeLaunchdJob,
  writeLaunchdPlist,
  type ExecFn,
} from "./launchd.js";
import { detectLegacyCaptureSweepAutomation } from "./legacy-capture.js";
import { cleanupLegacyHooks } from "./legacy-hooks.js";
import { automationLogPaths, launchAgentPlistPath } from "./paths.js";
import type {
  AutomationScheduler,
  AutomationSchedulerJob,
  AutomationSchedulerJobInput,
} from "../../shared/automation-scheduler.js";

export function createLaunchdAutomationScheduler(args: {
  exec?: ExecFn;
} = {}): AutomationScheduler {
  return {
    buildJob: buildLaunchdAutomationJob,
    defaultJobPath(input) {
      return input.plistPath ?? launchAgentPlistPath(input.label, input.homeDir);
    },
    async writeJobs(jobs) {
      await ensureLaunchdDirs(jobs);
      await Promise.all(jobs.map((job) => writeLaunchdPlist(job)));
    },
    async activateJob(job) {
      await bootstrapLaunchdJob(job.plistPath, args.exec);
    },
    async removeJob(plistPath) {
      return await removeLaunchdJob(plistPath, args.exec);
    },
    async readJobStatus(input) {
      const status = await readLaunchdJobStatus({
        label: input.label,
        plistPath: input.plistPath,
        exec: args.exec,
      });
      return {
        installed: status.installed,
        plistPath: status.plistPath,
        loaded: status.loaded,
        intervalSeconds: status.intervalSeconds,
        programArguments: status.contents === null
          ? null
          : readLaunchdProgramArguments(status.contents),
      };
    },
    async detectLegacyCaptureSweep(input) {
      const legacy = await detectLegacyCaptureSweepAutomation(input);
      return legacy === null
        ? null
        : {
          plistPath: legacy.plistPath,
          intervalSeconds: legacy.intervalSeconds,
          programArguments: readLaunchdProgramArguments(legacy.contents),
        };
    },
    async cleanupLegacyHooks(input) {
      await cleanupLegacyHooks(input);
    },
  };
}

function buildLaunchdAutomationJob(
  input: AutomationSchedulerJobInput,
): AutomationSchedulerJob {
  const logs = automationLogPaths({
    home: input.homeDir,
    stdoutLogName: input.stdoutLogName,
    stderrLogName: input.stderrLogName,
  });

  return {
    label: input.label,
    plistPath: input.plistPath ?? launchAgentPlistPath(input.label, input.homeDir),
    programArguments: input.programArguments,
    intervalSeconds: input.intervalSeconds,
    environmentVariables: {
      PATH: buildLaunchPath(input.homeDir, input.pathEnvironment),
    },
    workingDirectory: input.workingDirectory,
    stdoutPath: logs.stdoutPath,
    stderrPath: logs.stderrPath,
  };
}

function readLaunchdProgramArguments(contents: string): string[] {
  return [...contents.matchAll(/<string>([^<]*)<\/string>/g)]
    .map((match) => unescapeXml(match[1] ?? ""));
}

function unescapeXml(value: string): string {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}
