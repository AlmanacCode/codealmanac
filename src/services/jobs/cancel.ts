import {
  markJobCancelled,
  readJobRecordById,
  writeResolvedJobRecord,
} from "../../stores/jobs/index.js";
import { finishJobRecord } from "./record-lifecycle.js";
import type {
  CancelJobRequest,
  CancelJobServiceResult,
} from "./types.js";
import { resolveJobsRepoRoot } from "./repo-root.js";

export async function cancelJob(
  request: CancelJobRequest,
): Promise<CancelJobServiceResult> {
  const repoRoot = resolveJobsRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const record = await readJobRecordById(repoRoot, request.jobId);
  if (record === null) {
    return { status: "missing-job", jobId: request.jobId };
  }
  if (
    record.status === "done" ||
    record.status === "failed" ||
    record.status === "cancelled"
  ) {
    return {
      status: "already-terminal",
      jobId: record.id,
      jobStatus: record.status,
    };
  }

  await markJobCancelled(repoRoot, record.id);
  if (record.pid > 0) {
    try {
      request.signalProcess(record.pid, "SIGTERM");
    } catch {
      // Cancellation is still durable; stale detection covers exited processes.
    }
  }

  const cancelled = finishJobRecord({
    record,
    status: "cancelled",
    finishedAt: request.now?.() ?? new Date(),
  });
  await writeResolvedJobRecord(repoRoot, record.id, cancelled);
  return { status: "cancelled", jobId: record.id };
}
