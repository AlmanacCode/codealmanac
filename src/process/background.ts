import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

import type { AgentRunSpec, HarnessRunHooks } from "../harness/types.js";
import type { HarnessResult } from "../harness/events.js";
import { createRunId } from "./ids.js";
import { initializeRunLog } from "./logs.js";
import { startQueuedProcess } from "./manager.js";
import {
  buildQueuedRunRecord,
  finishRunRecord,
  readRunRecord,
  runRecordPath,
  writeRunRecord,
} from "./records.js";
import { readRunSpec, writeRunSpec } from "./spec.js";
import { acquireRunWorkerLock, oldestQueuedRun } from "./queue.js";
import type { RunRecord } from "./types.js";

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

export interface StartBackgroundProcessOptions {
  repoRoot: string;
  spec: AgentRunSpec;
  runId?: string;
  now?: () => Date;
  spawnBackground?: SpawnBackgroundFn;
  entrypoint?: string;
}

export interface StartBackgroundProcessResult {
  runId: string;
  record: RunRecord;
  childPid: number;
}

export async function startBackgroundProcess(
  options: StartBackgroundProcessOptions,
): Promise<StartBackgroundProcessResult> {
  const now = options.now ?? (() => new Date());
  const runId = options.runId ?? createRunId(now());
  await writeRunSpec(options.repoRoot, runId, options.spec);
  const recordPath = runRecordPath(options.repoRoot, runId);
  const queued = buildQueuedRunRecord({
    runId,
    repoRoot: options.repoRoot,
    spec: options.spec,
    queuedAt: now(),
  });
  await writeRunRecord(recordPath, queued);
  await initializeRunLog(queued.logPath);

  const entrypoint = options.entrypoint ?? process.argv[1];
  if (entrypoint === undefined || entrypoint.length === 0) {
    const error = "cannot start background process without an entrypoint";
    await writeRunRecord(
      recordPath,
      finishRunRecord({
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
      args: [entrypoint, "__run-worker"],
      cwd: options.repoRoot,
      env: childEnv,
    });
  } catch (err: unknown) {
    await writeRunRecord(
      recordPath,
      finishRunRecord({
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
  return { runId, record: queued, childPid };
}

export interface RunBackgroundWorkerOptions {
  repoRoot: string;
  now?: () => Date;
  pid?: number;
  onEvent?: (event: import("../harness/events.js").HarnessEvent) => void | Promise<void>;
  harnessRun?: (
    spec: AgentRunSpec,
    hooks?: HarnessRunHooks,
  ) => Promise<HarnessResult>;
}

export async function runBackgroundWorker(
  options: RunBackgroundWorkerOptions,
): Promise<void> {
  const now = options.now ?? (() => new Date());
  while (true) {
    const lock = await acquireRunWorkerLock(options.repoRoot, now());
    if (lock === null) return;
    try {
      while (true) {
        const record = await oldestQueuedRun(options.repoRoot);
        if (record === null) break;
        try {
          const spec = await readRunSpec(options.repoRoot, record.id);
          await startQueuedProcess({
            repoRoot: options.repoRoot,
            spec,
            runId: record.id,
            now,
            pid: options.pid,
            onEvent: options.onEvent,
            harnessRun: options.harnessRun,
          });
        } catch (err: unknown) {
          await markQueuedRunFailed({
            repoRoot: options.repoRoot,
            record,
            now: now(),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      await lock.release();
    }
    if (await oldestQueuedRun(options.repoRoot) === null) return;
  }
}

async function markQueuedRunFailed(args: {
  repoRoot: string;
  record: RunRecord;
  now: Date;
  error: string;
}): Promise<void> {
  const current = await readRunRecord(runRecordPath(args.repoRoot, args.record.id));
  if (current === null || current.status !== "queued") return;
  await writeRunRecord(
    runRecordPath(args.repoRoot, args.record.id),
    finishRunRecord({
      record: current,
      status: "failed",
      finishedAt: args.now,
      error: args.error,
    }),
  );
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
