import type { HarnessEvent, HarnessResult } from "../harness/events.js";
import type { HarnessRunHooks } from "../harness/types.js";
import type { OperationSpec } from "../operations/spec.js";
import { createJobId } from "./ids.js";
import { initializeJobLog } from "../stores/jobs/logs.js";
import { executeStartedJob, type StartJobResult } from "./executor.js";
import { buildStartedJobRecord } from "./record-factory.js";
import {
  jobRecordPath,
  readJobRecord,
  resolveJobLogPath,
  resolveJobRecordPath,
  writeJobRecord,
} from "../stores/jobs/records.js";
import { acquireJobWorkerLock } from "../stores/jobs/worker-lock.js";
import { cancelledRecordIfRequested } from "./finalization.js";
import type { JobRecord } from "./types.js";

export interface StartJobOptions {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  now?: () => Date;
  pid?: number;
  workerEnvironment: NodeJS.ProcessEnv;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  harnessRun?: (
    spec: OperationSpec,
    hooks?: HarnessRunHooks,
  ) => Promise<HarnessResult>;
}

export async function startForegroundJob(
  options: StartJobOptions,
): Promise<StartJobResult> {
  const now = options.now ?? (() => new Date());
  const jobId = options.jobId ?? createJobId(now());
  const startedAt = now();
  const lock = await acquireJobWorkerLock(options.repoRoot, startedAt);
  if (lock === null) {
    throw new Error(
      "another Almanac operation is already running for this wiki; " +
        "run without --foreground to queue this operation",
    );
  }
  try {
    const recordPath = jobRecordPath(options.repoRoot, jobId);
    const started = buildStartedJobRecord({
      jobId,
      repoRoot: options.repoRoot,
      spec: options.spec,
      startedAt,
      pid: options.pid,
    });

    const preStart = await cancelledRecordIfRequested({
      recordPath,
      repoRoot: options.repoRoot,
      jobId,
      fallback: started,
      finishedAt: now(),
    });
    if (preStart !== null) {
      return cancelledBeforeStartResult(jobId, preStart);
    }

    const logPath = await resolveJobLogPath(options.repoRoot, jobId);
    await writeJobRecord(recordPath, started);
    await initializeJobLog(logPath);
    const afterStart = await cancelledRecordIfRequested({
      recordPath,
      repoRoot: options.repoRoot,
      jobId,
      fallback: started,
      finishedAt: now(),
    });
    if (afterStart !== null) {
      return cancelledBeforeStartResult(jobId, afterStart);
    }

    return executeStartedJob({
      repoRoot: options.repoRoot,
      spec: options.spec,
      record: started,
      workerEnvironment: options.workerEnvironment,
      now,
      onEvent: options.onEvent,
      harnessRun: options.harnessRun,
    });
  } finally {
    await lock.release();
  }
}

export async function startQueuedJob(
  options: Omit<StartJobOptions, "jobId"> & { jobId: string },
): Promise<StartJobResult | null> {
  const now = options.now ?? (() => new Date());
  const recordPath = await resolveJobRecordPath(options.repoRoot, options.jobId);
  const existing = await readJobRecord(recordPath);
  if (existing === null || existing.status !== "queued") return null;

  const beforeClaim = await cancelledRecordIfRequested({
    recordPath,
    repoRoot: options.repoRoot,
    jobId: options.jobId,
    fallback: existing,
    finishedAt: now(),
  });
  if (beforeClaim !== null) {
    return cancelledBeforeStartResult(options.jobId, beforeClaim);
  }

  const running: JobRecord = {
    ...existing,
    status: "running",
    pid: options.pid ?? process.pid,
    startedAt: now().toISOString(),
    finishedAt: undefined,
    durationMs: undefined,
    summary: undefined,
    pageChanges: undefined,
    error: undefined,
    failure: undefined,
  };
  await writeJobRecord(recordPath, running);

  const afterClaim = await cancelledRecordIfRequested({
    recordPath,
    repoRoot: options.repoRoot,
    jobId: options.jobId,
    fallback: running,
    finishedAt: now(),
  });
  if (afterClaim !== null) {
    return cancelledBeforeStartResult(options.jobId, afterClaim);
  }

  return executeStartedJob({
    repoRoot: options.repoRoot,
    spec: options.spec,
    record: running,
    workerEnvironment: options.workerEnvironment,
    now,
    onEvent: options.onEvent,
    harnessRun: options.harnessRun,
  });
}

function cancelledBeforeStartResult(
  jobId: string,
  record: JobRecord,
): StartJobResult {
  return {
    jobId,
    record,
    result: {
      success: false,
      result: "",
      error: "job cancelled before start",
    },
  };
}
