import type { HarnessFailure } from "../../harness/events.js";
import * as operations from "../../operations/index.js";

export type LifecycleOperationMode = "foreground" | "background";
export type LifecycleOperationJobStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export interface LifecycleOperationJobResult {
  status: LifecycleOperationJobStatus;
  pid: number;
  logPath: string;
  failure?: HarnessFailure;
}

export interface LifecycleOperationForegroundResult {
  success: boolean;
  error?: string;
  failure?: HarnessFailure;
}

export interface LifecycleOperationBackgroundResult {
  childPid: number;
}

export interface LifecycleOperationRunResult {
  mode: LifecycleOperationMode;
  jobId: string;
  job: LifecycleOperationJobResult;
  foreground?: LifecycleOperationForegroundResult;
  background?: LifecycleOperationBackgroundResult;
}

export function lifecycleOperationRunResultFromOperation(
  result: operations.OperationRunResult,
): LifecycleOperationRunResult {
  const record = result.background?.record ?? result.foreground?.record;
  if (record === undefined) {
    throw new Error(`operation ${result.jobId} did not return a job record`);
  }
  return {
    mode: result.mode,
    jobId: result.jobId,
    job: {
      status: record.status,
      pid: record.pid,
      logPath: record.logPath,
      ...(record.failure !== undefined ? { failure: record.failure } : {}),
    },
    ...(result.foreground !== undefined
      ? { foreground: lifecycleForegroundResultFromOperation(result.foreground.result) }
      : {}),
    ...(result.background !== undefined
      ? { background: { childPid: result.background.childPid } }
      : {}),
  };
}

function lifecycleForegroundResultFromOperation(
  result: NonNullable<operations.OperationRunResult["foreground"]>["result"],
): LifecycleOperationForegroundResult {
  return {
    success: result.success,
    ...(result.error !== undefined ? { error: result.error } : {}),
    ...(result.failure !== undefined ? { failure: result.failure } : {}),
  };
}
