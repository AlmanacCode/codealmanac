import {
  readJobLogChunk,
  readJobLogContents,
  readJobRecordById,
} from "../../stores/jobs/index.js";
import type {
  JobLogRequest,
  ReadJobLogServiceResult,
  StreamJobLogRequest,
  StreamJobLogServiceResult,
} from "./types.js";
import {
  buildJobServiceView,
  isTerminalJobServiceView,
} from "./view.js";
import { resolveJobsRepoRoot } from "./repo-root.js";

export async function readJobLog(
  request: JobLogRequest,
): Promise<ReadJobLogServiceResult> {
  const repoRoot = resolveJobsRepoRoot(request.cwd);
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

export async function streamJobLog(
  request: StreamJobLogRequest,
): Promise<StreamJobLogServiceResult> {
  const repoRoot = resolveJobsRepoRoot(request.cwd);
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
