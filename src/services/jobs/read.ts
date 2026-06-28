import {
  listJobRecords,
  readJobRecordById,
} from "../../stores/jobs/index.js";
import type {
  JobRequest,
  JobServiceView,
  JobsRequest,
  ListJobsServiceResult,
  ReadJobServiceResult,
} from "./types.js";
import { buildJobServiceView } from "./view.js";
import { resolveJobsRepoRoot } from "./repo-root.js";

export async function listJobs(
  request: JobsRequest,
): Promise<ListJobsServiceResult> {
  const repoRoot = resolveJobsRepoRoot(request.cwd);
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
  const repoRoot = resolveJobsRepoRoot(request.cwd);
  if (repoRoot === null) return { status: "missing-wiki" };

  const job = await readJobView(repoRoot, request);
  if (job === null) {
    return { status: "missing-job", jobId: request.jobId };
  }
  return { status: "found", job };
}

async function readJobView(
  repoRoot: string,
  request: JobRequest,
): Promise<JobServiceView | null> {
  const record = await readJobRecordById(repoRoot, request.jobId);
  if (record === null) return null;
  return buildJobServiceView({ record, request });
}
