import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";

import type { AgentRunSpec, HarnessRunHooks } from "../harness/types.js";
import type { HarnessResult } from "../harness/events.js";
import { stripLoadedProjectEnv } from "../env.js";
import { createRunId } from "./ids.js";
import { initializeRunLog } from "./logs.js";
import { startForegroundProcess, type StartProcessResult } from "./manager.js";
import {
  buildQueuedRunRecord,
  finishRunRecord,
  readRunRecord,
  runRecordPath,
  writeRunRecord,
} from "./records.js";
import { readRunSpec, writeRunSpec } from "./spec.js";
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
  stderrPath: string;
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
  let child: BackgroundChild;
  try {
    child = spawnFn({
      command: process.execPath,
      args: [entrypoint, "__run-job", runId],
      cwd: options.repoRoot,
      env: {
        ...stripLoadedProjectEnv(process.env),
        CODEALMANAC_INTERNAL_SESSION: "1",
      },
      stderrPath: `${queued.logPath}.stderr`,
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

export interface RunBackgroundChildOptions {
  repoRoot: string;
  runId: string;
  now?: () => Date;
  pid?: number;
  onEvent?: (event: import("../harness/events.js").HarnessEvent) => void | Promise<void>;
  harnessRun?: (
    spec: AgentRunSpec,
    hooks?: HarnessRunHooks,
  ) => Promise<HarnessResult>;
}

export async function runBackgroundChild(
  options: RunBackgroundChildOptions,
): Promise<StartProcessResult> {
  const existing = await readRunRecord(runRecordPath(options.repoRoot, options.runId));
  if (existing?.status === "cancelled") {
    return {
      runId: options.runId,
      record: existing,
      result: {
        success: false,
        result: "",
        error: "run cancelled before start",
      },
    };
  }
  const spec = await readRunSpec(options.repoRoot, options.runId);
  return startForegroundProcess({
    repoRoot: options.repoRoot,
    spec,
    runId: options.runId,
    now: options.now,
    pid: options.pid,
    onEvent: options.onEvent,
    harnessRun: options.harnessRun,
  });
}

function defaultSpawnBackground(args: {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stderrPath: string;
}): ChildProcess {
  const stderrFd = openSync(args.stderrPath, "a");
  try {
    return spawn(args.command, args.args, {
      cwd: args.cwd,
      env: args.env,
      detached: true,
      stdio: ["ignore", "ignore", stderrFd],
    });
  } finally {
    closeSync(stderrFd);
  }
}
