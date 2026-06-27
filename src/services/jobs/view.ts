import {
  toJobView,
  type JobRecord,
  type JobView as RuntimeJobView,
} from "../../jobs/index.js";
import { isLocalPidAlive } from "../../platform/process.js";
import type {
  JobServiceView,
  JobsRequest,
} from "./types.js";

export function buildJobServiceView(args: {
  record: JobRecord;
  request: Pick<JobsRequest, "now" | "isPidAlive">;
}): JobServiceView {
  return jobServiceViewFromRuntime(
    toJobView({
      record: args.record,
      now: args.request.now?.() ?? new Date(),
      isPidAlive: args.request.isPidAlive ?? isLocalPidAlive,
    }),
  );
}

export function isTerminalJobServiceView(view: JobServiceView): boolean {
  return (
    view.displayStatus === "done" ||
    view.displayStatus === "failed" ||
    view.displayStatus === "cancelled" ||
    view.displayStatus === "stale"
  );
}

function jobServiceViewFromRuntime(view: RuntimeJobView): JobServiceView {
  return {
    version: view.version,
    id: view.id,
    operation: view.operation,
    status: view.status,
    repoRoot: view.repoRoot,
    pid: view.pid,
    provider: view.provider,
    ...(view.model !== undefined ? { model: view.model } : {}),
    ...(view.providerSessionId !== undefined
      ? { providerSessionId: view.providerSessionId }
      : {}),
    startedAt: view.startedAt,
    ...(view.finishedAt !== undefined ? { finishedAt: view.finishedAt } : {}),
    ...(view.durationMs !== undefined ? { durationMs: view.durationMs } : {}),
    logPath: view.logPath,
    ...(view.targetKind !== undefined ? { targetKind: view.targetKind } : {}),
    ...(view.targetPaths !== undefined ? { targetPaths: view.targetPaths } : {}),
    ...(view.summary !== undefined ? { summary: view.summary } : {}),
    ...(view.pageChanges !== undefined ? { pageChanges: view.pageChanges } : {}),
    ...(view.operationOutput !== undefined
      ? { operationOutput: view.operationOutput }
      : {}),
    ...(view.error !== undefined ? { error: view.error } : {}),
    ...(view.failure !== undefined ? { failure: view.failure } : {}),
    displayStatus: view.displayStatus,
    elapsedMs: view.elapsedMs,
  };
}
