import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import type { HarnessEvent, HarnessResult } from "../harness/events.js";
import type { HarnessRunHooks } from "../harness/types.js";
import type { OperationSpec } from "../operations/spec.js";
import { createJobId } from "./ids.js";
import { initializeJobLog } from "./logs.js";
import { executeStartedJob, type StartJobResult } from "./executor.js";
import {
  buildQueuedJobRecord,
  buildStartedJobRecord,
  finishJobRecord,
} from "./record-factory.js";
import {
  jobRecordPath,
  readJobRecord,
  resolveJobLogPath,
  resolveJobRecordPath,
  writeJobRecord,
} from "../stores/jobs/records.js";
import { acquireJobWorkerLock } from "./queue.js";
import { writeJobSpec } from "./spec.js";
import { cancelledRecordIfRequested } from "./finalization.js";
import type { JobRecord } from "./types.js";

export interface StartJobOptions {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  now?: () => Date;
  pid?: number;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  harnessRun?: (
    spec: OperationSpec,
    hooks?: HarnessRunHooks,
  ) => Promise<HarnessResult>;
}

export interface BackgroundChild {
  pid?: number;
  unref?: () => void;
}

export type SpawnBackgroundFn = (args: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}) => BackgroundChild;

export interface StartBackgroundJobOptions {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  now?: () => Date;
  spawnBackground?: SpawnBackgroundFn;
  entrypoint?: string;
}

export interface StartBackgroundJobResult {
  jobId: string;
  record: JobRecord;
  childPid: number;
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
      "another Almanac operation is already running for this wiki; run without --foreground to queue this operation",
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
    now,
    onEvent: options.onEvent,
    harnessRun: options.harnessRun,
  });
}

export async function startBackgroundJob(
  options: StartBackgroundJobOptions,
): Promise<StartBackgroundJobResult> {
  const now = options.now ?? (() => new Date());
  const jobId = options.jobId ?? createJobId(now());
  await writeJobSpec(options.repoRoot, jobId, options.spec);
  const recordPath = jobRecordPath(options.repoRoot, jobId);
  const queued = buildQueuedJobRecord({
    jobId,
    repoRoot: options.repoRoot,
    spec: options.spec,
    queuedAt: now(),
  });
  await writeJobRecord(recordPath, queued);
  await initializeJobLog(queued.logPath);

  const entrypoint = options.entrypoint ?? process.argv[1];
  if (entrypoint === undefined || entrypoint.length === 0) {
    const error = "cannot start background process without an entrypoint";
    await writeJobRecord(
      recordPath,
      finishJobRecord({
        record: queued,
        status: "failed",
        finishedAt: now(),
        error,
      }),
    );
    throw new Error(error);
  }

  const spawnFn = options.spawnBackground ?? defaultSpawnBackground;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
  };
  let child: BackgroundChild;
  try {
    child = spawnFn({
      command: process.execPath,
      args: [entrypoint, "__job-worker"],
      cwd: options.repoRoot,
      env: childEnv,
    });
  } catch (err: unknown) {
    await writeJobRecord(
      recordPath,
      finishJobRecord({
        record: queued,
        status: "failed",
        finishedAt: now(),
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    throw err;
  }
  child.unref?.();
  const childPid = child.pid ?? 0;
  return { jobId, record: queued, childPid };
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

function defaultSpawnBackground(args: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}): ChildProcess {
  return spawn(args.command, args.args, {
    cwd: args.cwd,
    env: args.env,
    detached: true,
    stdio: "ignore",
  });
}
