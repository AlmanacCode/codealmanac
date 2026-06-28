import {
  listJobRecords,
  readJobRecord,
  readJobSpec,
  resolveJobLogPath,
  resolveJobRecordPath,
  toJobView,
} from "../../jobs/index.js";
import {
  enrichJobView,
} from "../../jobs/projections/view.js";
import { deriveJobAgentTraces } from "../../jobs/projections/agent-traces.js";
import { deriveJobWarnings } from "../../jobs/projections/warnings.js";
import { readJobLogEvents } from "../../jobs/projections/log-events.js";
import type {
  ViewerJobDetail,
  ViewerJobRun,
} from "./job-types.js";

export interface ViewerJobsRuntime {
  isPidAlive(pid: number): boolean;
}

export type {
  ViewerAgentTrace,
  ViewerJobDetail,
  ViewerJobPageChangeDetails,
  ViewerJobPageChangeRef,
  ViewerJobRun,
  ViewerRunWarning,
} from "./job-types.js";

export async function listViewerJobs(
  repoRoot: string,
  runtime: ViewerJobsRuntime,
): Promise<{ runs: ViewerJobRun[] }> {
  const records = await listJobRecords(repoRoot);
  const runs = await Promise.all(
    records
      .filter((record) => isSafeJobId(record.id))
      .map(async (record) => {
        const view = toJobView({
          record,
          now: new Date(),
          isPidAlive: runtime.isPidAlive,
        });
        const events = await readJobLogEvents(await resolveJobLogPath(repoRoot, record.id));
        const specPrompt = await readSpecPrompt(repoRoot, record.id);
        return enrichJobView(view, events, specPrompt);
      }),
  );
  return { runs };
}

export async function getViewerJob(
  repoRoot: string,
  jobId: string,
  runtime: ViewerJobsRuntime,
): Promise<ViewerJobDetail | null> {
  if (!isSafeJobId(jobId)) return null;
  const record = await readJobRecord(await resolveJobRecordPath(repoRoot, jobId));
  if (record === null || record.id !== jobId) return null;
  const events = await readJobLogEvents(await resolveJobLogPath(repoRoot, record.id));
  const specPrompt = await readSpecPrompt(repoRoot, record.id);
  const agents = deriveJobAgentTraces(events);
  const run = toJobView({
    record,
    now: new Date(),
    isPidAlive: runtime.isPidAlive,
  });
  return {
    run: enrichJobView(
      run,
      events,
      specPrompt,
    ),
    events,
    agents,
    warnings: deriveJobWarnings(record.operation, run, events),
  };
}

function isSafeJobId(jobId: string): boolean {
  return /^(job|run)_[A-Za-z0-9_-]+$/.test(jobId);
}

async function readSpecPrompt(repoRoot: string, jobId: string): Promise<string | null> {
  try {
    return (await readJobSpec(repoRoot, jobId)).prompt;
  } catch {
    return null;
  }
}
