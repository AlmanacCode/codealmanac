import { readFile } from "node:fs/promises";

import {
  finishJobRecord,
  listJobRecords,
  markJobCancelled,
  readJobRecord,
  resolveJobLogPath,
  resolveJobRecordPath,
  writeJobRecord,
} from "../../jobs/index.js";
import { findNearestAlmanacDir } from "../../paths.js";
import { signalLocalPid } from "../../platform/process.js";
import type {
  CancelJobRequest,
  CancelJobServiceResult,
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
  request: JobRequest,
): Promise<ReadJobLogServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const record = await readJobRecord(
    await resolveJobRecordPath(repoRoot, request.jobId),
  );
  if (record === null) {
    return { status: "missing-job", jobId: request.jobId };
  }

  try {
    return {
      status: "found",
      contents: await readFile(
        await resolveJobLogPath(repoRoot, record.id),
        "utf8",
      ),
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

  const path = await resolveJobRecordPath(repoRoot, request.jobId);
  const record = await readJobRecord(path);
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
      (request.signalProcess ?? signalLocalPid)(record.pid, "SIGTERM");
    } catch {
      // Cancellation is still durable; stale detection covers exited processes.
    }
  }

  const cancelled = finishJobRecord({
    record,
    status: "cancelled",
    finishedAt: request.now?.() ?? new Date(),
  });
  await writeJobRecord(path, cancelled);
  return { status: "cancelled", jobId: record.id };
}

export async function streamJobLog(
  request: StreamJobLogRequest,
): Promise<StreamJobLogServiceResult> {
  const repoRoot = resolveRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const initial = await readJobRecord(
    await resolveJobRecordPath(repoRoot, request.jobId),
  );
  if (initial === null) {
    return { status: "missing-job", jobId: request.jobId };
  }

  let offset = 0;
  while (true) {
    const record = await readJobRecord(
      await resolveJobRecordPath(repoRoot, request.jobId),
    );
    if (record === null) {
      return { status: "missing-job", jobId: request.jobId };
    }
    offset = await writeLogChunk(
      await resolveJobLogPath(repoRoot, record.id),
      offset,
      request.write,
    );
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
  const record = await readJobRecord(
    await resolveJobRecordPath(repoRoot, request.jobId),
  );
  if (record === null) return null;
  return buildJobServiceView({ record, request });
}

function resolveRepoRoot(cwd: string): string | null {
  return findNearestAlmanacDir(cwd);
}

async function writeLogChunk(
  path: string,
  offset: number,
  write: (chunk: string) => void,
): Promise<number> {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch {
    return offset;
  }
  if (text.length <= offset) return offset;
  write(text.slice(offset));
  return text.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
