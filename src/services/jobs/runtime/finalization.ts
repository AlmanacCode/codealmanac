import type { AgentRuntimeFailure } from "../../../shared/agent-runtime/events.js";
import { finishJobRecord } from "../record-lifecycle.js";
import {
  isJobCancellationRequested,
  readJobRecord,
  writeJobRecord,
} from "../../../stores/jobs/index.js";
import type {
  JobOperationOutput,
  JobPageChanges,
  JobRecord,
  JobSummary,
} from "../../../stores/jobs/index.js";

export async function finishUnlessCancelled(args: {
  recordPath: string;
  fallback: JobRecord;
  status: "done" | "failed";
  finishedAt: Date;
  providerSessionId?: string;
  summary?: JobSummary;
  pageChanges?: JobPageChanges;
  operationOutput?: JobOperationOutput;
  error?: string;
  failure?: AgentRuntimeFailure;
}): Promise<JobRecord> {
  const current = await readJobRecord(args.recordPath);
  if (
    current?.status === "cancelled" ||
    isJobCancellationRequested(args.fallback.repoRoot, args.fallback.id)
  ) {
    return finishCancelled({
      recordPath: args.recordPath,
      fallback: current ?? args.fallback,
      finishedAt: args.finishedAt,
    });
  }
  const base = current ?? args.fallback;
  const finished = finishJobRecord({
    record: base,
    status: args.status,
    finishedAt: args.finishedAt,
    providerSessionId: args.providerSessionId,
    summary: args.summary,
    pageChanges: args.pageChanges,
    operationOutput: args.operationOutput,
    error: args.error,
    failure: args.failure,
  });
  await writeJobRecord(args.recordPath, finished);
  return finished;
}

export async function cancelledRecordIfRequested(args: {
  recordPath: string;
  repoRoot: string;
  jobId: string;
  fallback: JobRecord;
  finishedAt: Date;
}): Promise<JobRecord | null> {
  const current = await readJobRecord(args.recordPath);
  if (
    current?.status !== "cancelled" &&
    !isJobCancellationRequested(args.repoRoot, args.jobId)
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
  fallback: JobRecord;
  finishedAt: Date;
}): Promise<JobRecord> {
  const cancelled =
    args.fallback.status === "cancelled"
      ? args.fallback
      : finishJobRecord({
          record: args.fallback,
          status: "cancelled",
          finishedAt: args.finishedAt,
        });
  await writeJobRecord(args.recordPath, cancelled);
  return cancelled;
}
