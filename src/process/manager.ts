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
  runRecordPath,
  writeRunRecord,
} from "./records.js";
import { diffPageSnapshots, snapshotPages } from "./snapshots.js";
import type { RunRecord, RunSummary } from "./types.js";

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

  await writeRunRecord(recordPath, started);
  await initializeRunLog(started.logPath);
  const pagesDir = join(options.repoRoot, ".almanac", "pages");
  const before = await snapshotPages(pagesDir);

  const harnessRun =
    options.harnessRun ??
    ((spec, hooks) => getHarnessProvider(spec.provider.id).run(spec, hooks));
  const eventWrites: Promise<void>[] = [];

  let result: HarnessResult;
  try {
    result = await harnessRun(options.spec, {
      onEvent: eventLogger(started.logPath, now, eventWrites, options.onEvent),
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
    }, now());
  }
  await Promise.allSettled(eventWrites);

  const after = await snapshotPages(pagesDir);
  const delta = diffPageSnapshots(before, after);
  if (result.success) {
    await runIndexer({ repoRoot: options.repoRoot });
  }

  const summary: RunSummary = {
    created: delta.created,
    updated: delta.updated,
    archived: delta.archived,
    costUsd: result.costUsd,
    turns: result.turns,
    usage: result.usage,
  };
  const finished = finishRunRecord({
    record: started,
    status: result.success ? "done" : "failed",
    finishedAt: now(),
    providerSessionId: result.providerSessionId,
    summary,
    error: result.error,
  });
  await writeRunRecord(recordPath, finished);

  return { runId, record: finished, result };
}

function eventLogger(
  path: string,
  now: () => Date,
  writes: Promise<void>[],
  observer?: (event: HarnessEvent) => void | Promise<void>,
): (event: HarnessEvent) => void {
  return (event) => {
    writes.push(appendRunEvent(path, event, now()));
    if (observer !== undefined) {
      writes.push(Promise.resolve(observer(event)));
    }
  };
}
