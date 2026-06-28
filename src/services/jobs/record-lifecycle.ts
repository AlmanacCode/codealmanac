import type { AgentRuntimeFailure } from "../../shared/agent-runtime/events.js";
import type { OperationSpec } from "../lifecycle/operations/spec.js";
import { jobLogPath } from "../../stores/jobs/index.js";
import type {
  JobOperationOutput,
  JobPageChanges,
  JobRecord,
  JobStatus,
  JobSummary,
} from "../../stores/jobs/index.js";

export function buildStartedJobRecord(args: {
  jobId: string;
  repoRoot: string;
  spec: OperationSpec;
  startedAt: Date;
  pid: number;
}): JobRecord {
  return {
    version: 1,
    id: args.jobId,
    operation: args.spec.metadata?.operation ?? "absorb",
    status: "running",
    repoRoot: args.repoRoot,
    pid: args.pid,
    provider: args.spec.provider.id,
    model: args.spec.provider.model,
    startedAt: args.startedAt.toISOString(),
    logPath: jobLogPath(args.repoRoot, args.jobId),
    targetKind: args.spec.metadata?.targetKind,
    targetPaths: args.spec.metadata?.targetPaths,
  };
}

export function buildQueuedJobRecord(args: {
  jobId: string;
  repoRoot: string;
  spec: OperationSpec;
  queuedAt: Date;
}): JobRecord {
  return {
    ...buildStartedJobRecord({
      jobId: args.jobId,
      repoRoot: args.repoRoot,
      spec: args.spec,
      startedAt: args.queuedAt,
      pid: 0,
    }),
    status: "queued",
  };
}

export function finishJobRecord(args: {
  record: JobRecord;
  status: Extract<JobStatus, "done" | "failed" | "cancelled">;
  finishedAt: Date;
  providerSessionId?: string;
  summary?: JobSummary;
  pageChanges?: JobPageChanges;
  operationOutput?: JobOperationOutput;
  error?: string;
  failure?: AgentRuntimeFailure;
}): JobRecord {
  const started = Date.parse(args.record.startedAt);
  const finished = args.finishedAt.getTime();
  return {
    ...args.record,
    status: args.status,
    providerSessionId: args.providerSessionId ?? args.record.providerSessionId,
    finishedAt: args.finishedAt.toISOString(),
    durationMs: Number.isFinite(started)
      ? Math.max(0, finished - started)
      : undefined,
    summary: args.summary,
    pageChanges: args.pageChanges,
    operationOutput: args.operationOutput,
    error: args.error,
    failure: args.failure,
  };
}
