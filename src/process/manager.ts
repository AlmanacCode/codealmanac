import { join } from "node:path";

import type { HarnessEvent, HarnessResult } from "../harness/events.js";
import type { AgentRunSpec, HarnessRunHooks } from "../harness/types.js";
import { getHarnessProvider } from "../harness/providers/index.js";
import { runIndexer } from "../indexer/index.js";
import { createRunId } from "./ids.js";
import { appendRunEvent, initializeRunLog } from "./logs.js";
import {
  buildStartedRunRecord,
  finishRunRecord,
  isRunCancellationRequested,
  readRunRecord,
  runRecordPath,
  writeRunRecord,
} from "./records.js";
import { diffPageSnapshots, snapshotPages } from "./snapshots.js";
import type { RunPageChanges, RunRecord, RunSummary } from "./types.js";

export interface StartProcessOptions {
  repoRoot: string;
  spec: AgentRunSpec;
  runId?: string;
  now?: () => Date;
  pid?: number;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  harnessRun?: (
    spec: AgentRunSpec,
    hooks?: HarnessRunHooks,
  ) => Promise<HarnessResult>;
}

export interface StartProcessResult {
  runId: string;
  record: RunRecord;
  result: HarnessResult;
}

export async function startForegroundProcess(
  options: StartProcessOptions,
): Promise<StartProcessResult> {
  const now = options.now ?? (() => new Date());
  const runId = options.runId ?? createRunId(now());
  const startedAt = now();
  const recordPath = runRecordPath(options.repoRoot, runId);
  const started = buildStartedRunRecord({
    runId,
    repoRoot: options.repoRoot,
    spec: options.spec,
    startedAt,
    pid: options.pid,
  });

  const preStart = await cancelledRecordIfRequested({
    recordPath,
    repoRoot: options.repoRoot,
    runId,
    fallback: started,
    finishedAt: now(),
  });
  if (preStart !== null) {
    return {
      runId,
      record: preStart,
      result: {
        success: false,
        result: "",
        error: "run cancelled before start",
      },
    };
  }

  await writeRunRecord(recordPath, started);
  await initializeRunLog(started.logPath);
  const afterStart = await cancelledRecordIfRequested({
    recordPath,
    repoRoot: options.repoRoot,
    runId,
    fallback: started,
    finishedAt: now(),
  });
  if (afterStart !== null) {
    return {
      runId,
      record: afterStart,
      result: {
        success: false,
        result: "",
        error: "run cancelled before start",
      },
    };
  }

  const harnessRun =
    options.harnessRun ??
    ((spec, hooks) => getHarnessProvider(spec.provider.id).run(spec, hooks));
  const eventWrites: Promise<void>[] = [];

  let result: HarnessResult;
  let finalRecord: RunRecord;
  let summary: RunSummary | undefined;
  let pageChanges: RunPageChanges | undefined;
  try {
    const pagesDir = join(options.repoRoot, ".almanac", "pages");
    const before = await snapshotPages(pagesDir);
    try {
      result = await harnessRun(options.spec, {
        onEvent: eventLogger(started.logPath, runId, now, eventWrites, options.onEvent),
      });
    } catch (err: unknown) {
      result = {
        success: false,
        result: "",
        error: err instanceof Error ? err.message : String(err),
      };
      await appendRunEvent(started.logPath, {
        type: "error",
        error: result.error ?? "unknown error",
      }, now(), { runId, sequence: eventWrites.length + 1 });
    }
    await Promise.allSettled(eventWrites);

    const after = await snapshotPages(pagesDir);
    const delta = diffPageSnapshots(before, after);
    summary = {
      created: delta.created.length,
      updated: delta.updated.length,
      archived: delta.archived.length,
      deleted: delta.deleted.length,
      costUsd: result.costUsd,
      turns: result.turns,
      usage: result.usage,
    };
    const resultSummary = harnessResultSummary(result.result);
    pageChanges = {
      version: 1,
      runId,
      created: delta.created,
      updated: delta.updated,
      archived: delta.archived,
      deleted: delta.deleted,
      ...(resultSummary !== undefined ? { summary: resultSummary } : {}),
    };
    if (result.success) {
      await runIndexer({ repoRoot: options.repoRoot });
    }
    finalRecord = await finishUnlessCancelled({
      recordPath,
      fallback: started,
      status: result.success ? "done" : "failed",
      finishedAt: now(),
      providerSessionId: result.providerSessionId,
      summary,
      pageChanges,
      error: result.error,
      failure: result.failure,
    });
  } catch (err: unknown) {
    result = {
      success: false,
      result: "",
      error: err instanceof Error ? err.message : String(err),
    };
    try {
      await appendRunEvent(started.logPath, {
        type: "error",
        error: result.error ?? "unknown error",
      }, now(), { runId, sequence: eventWrites.length + 1 });
    } catch {
      // The run record is the source of truth; do not let a broken log write
      // prevent terminal status recording.
    }
    await Promise.allSettled(eventWrites);
    finalRecord = await finishUnlessCancelled({
      recordPath,
      fallback: started,
      status: "failed",
      finishedAt: now(),
      summary,
      pageChanges,
      error: result.error,
      failure: result.failure,
    });
  }

  if (finalRecord.status === "cancelled" && result.success) {
    result = {
      success: false,
      result: "",
      error: "run cancelled before final status",
    };
  }
  return { runId, record: finalRecord, result };
}

async function finishUnlessCancelled(args: {
  recordPath: string;
  fallback: RunRecord;
  status: "done" | "failed";
  finishedAt: Date;
  providerSessionId?: string;
  summary?: RunSummary;
  pageChanges?: RunPageChanges;
  error?: string;
  failure?: import("../harness/events.js").HarnessFailure;
}): Promise<RunRecord> {
  const current = await readRunRecord(args.recordPath);
  if (
    current?.status === "cancelled" ||
    isRunCancellationRequested(args.fallback.repoRoot, args.fallback.id)
  ) {
    return finishCancelled({
      recordPath: args.recordPath,
      fallback: current ?? args.fallback,
      finishedAt: args.finishedAt,
    });
  }
  const base = current ?? args.fallback;
  const finished = finishRunRecord({
    record: base,
    status: args.status,
    finishedAt: args.finishedAt,
    providerSessionId: args.providerSessionId,
    summary: args.summary,
    pageChanges: args.pageChanges,
    error: args.error,
    failure: args.failure,
  });
  await writeRunRecord(args.recordPath, finished);
  return finished;
}

async function cancelledRecordIfRequested(args: {
  recordPath: string;
  repoRoot: string;
  runId: string;
  fallback: RunRecord;
  finishedAt: Date;
}): Promise<RunRecord | null> {
  const current = await readRunRecord(args.recordPath);
  if (
    current?.status !== "cancelled" &&
    !isRunCancellationRequested(args.repoRoot, args.runId)
  ) {
    return null;
  }
  return finishCancelled({
    recordPath: args.recordPath,
    fallback: current ?? args.fallback,
    finishedAt: args.finishedAt,
  });
}

async function finishCancelled(args: {
  recordPath: string;
  fallback: RunRecord;
  finishedAt: Date;
}): Promise<RunRecord> {
  const cancelled =
    args.fallback.status === "cancelled"
      ? args.fallback
      : finishRunRecord({
          record: args.fallback,
          status: "cancelled",
          finishedAt: args.finishedAt,
        });
  await writeRunRecord(args.recordPath, cancelled);
  return cancelled;
}

function eventLogger(
  path: string,
  runId: string,
  now: () => Date,
  writes: Promise<void>[],
  observer?: (event: HarnessEvent) => void | Promise<void>,
): (event: HarnessEvent) => void {
  let sequence = 0;
  return (event) => {
    sequence += 1;
    writes.push(appendRunEvent(path, event, now(), { runId, sequence }));
    if (observer !== undefined) {
      writes.push(Promise.resolve(observer(event)));
    }
  };
}

function harnessResultSummary(result: string): string | undefined {
  for (const rawLine of result.split(/\r?\n/)) {
    const line = rawLine.replace(/^#+\s*/, "").trim();
    if (line.length === 0 || line === "---") continue;
    return line.length > 500 ? `${line.slice(0, 497)}...` : line;
  }
  return undefined;
}
