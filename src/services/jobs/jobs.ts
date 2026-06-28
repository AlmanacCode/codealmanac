import {
  listJobRecords,
  markJobCancelled,
  readJobLogChunk,
  readJobLogContents,
  readJobRecordById,
  writeResolvedJobRecord,
} from "../../stores/jobs/index.js";
import { findNearestAlmanacDir } from "../../stores/wiki-files/repo-location.js";
import { finishJobRecord } from "./record-lifecycle.js";
import type {
  CancelJobRequest,
  CancelJobServiceResult,
  JobLogRequest,
  JobServiceView,
  JobRequest,
  JobsRequest,
  ListJobsServiceResult,
  ReadJobLogServiceResult,
  ReadJobServiceResult,
  StreamJobLogRequest,
  StreamJobLogServiceResult,
} from "./types.js";
import {
  buildJobServiceView,
  isTerminalJobServiceView,
} from "./view.js";

export async function listJobs(
  request: JobsRequest,
): Promise<ListJobsServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const records = await listJobRecords(repoRoot);
  return {
    status: "listed",
    jobs: records.map((record) =>
      buildJobServiceView({
        record,
        request,
      }),
    ),
  };
}

export async function readJob(
  request: JobRequest,
): Promise<ReadJobServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const job = await readJobView(repoRoot, request);
  if (job === null) {
    return { status: "missing-job", jobId: request.jobId };
  }
  return { status: "found", job };
}

export async function readJobLog(
  request: JobLogRequest,
): Promise<ReadJobLogServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const record = await readJobRecordById(repoRoot, request.jobId);
  if (record === null) {
    return { status: "missing-job", jobId: request.jobId };
  }

  try {
    return {
      status: "found",
      contents: await readJobLogContents(repoRoot, record.id),
    };
  } catch (err: unknown) {
    return {
      status: "read-error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function cancelJob(
  request: CancelJobRequest,
): Promise<CancelJobServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
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

export async function streamJobLog(
  request: StreamJobLogRequest,
): Promise<StreamJobLogServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const initial = await readJobRecordById(repoRoot, request.jobId);
  if (initial === null) {
    return { status: "missing-job", jobId: request.jobId };
  }

  let offset = 0;
  while (true) {
    const record = await readJobRecordById(repoRoot, request.jobId);
    if (record === null) {
      return { status: "missing-job", jobId: request.jobId };
    }
    offset = await writeLogChunk(repoRoot, record.id, offset, request.write);
    const view = buildJobServiceView({ record, request });
    if (isTerminalJobServiceView(view)) {
      return { status: "streamed", terminalJob: view };
    }
    await sleep(request.pollMs ?? 500);
  }
}

async function readJobView(
  repoRoot: string,
  request: JobRequest,
): Promise<JobServiceView | null> {
  const record = await readJobRecordById(repoRoot, request.jobId);
  if (record === null) return null;
  return buildJobServiceView({ record, request });
}

function resolveRepoRoot(cwd: string): string | null {
  return findNearestAlmanacDir(cwd);
}

async function writeLogChunk(
  repoRoot: string,
  jobId: string,
  offset: number,
  write: (chunk: string) => void,
): Promise<number> {
  try {
    const chunk = await readJobLogChunk(repoRoot, jobId, offset);
    if (chunk.contents.length > 0) write(chunk.contents);
    return chunk.nextOffset;
  } catch {
    return offset;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
