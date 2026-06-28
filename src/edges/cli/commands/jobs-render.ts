import { UserFacingError } from "../../../shared/user-facing-error.js";
import type {
  CancelJobServiceResult,
  ListJobsServiceResult,
  MissingJobResult,
  MissingWikiResult,
  ReadJobLogServiceResult,
  ReadJobServiceResult,
  StreamJobLogServiceResult,
} from "../../../services/jobs/index.js";
import { renderError, renderOutcome } from "./outcome.js";
import type { JobsCommandResult } from "./jobs.js";
import {
  formatJobDetails,
  formatJobRows,
  terminalAttachSummary,
} from "./jobs-format.js";

export function renderJobsListResult(
  result: ListJobsServiceResult,
  json: boolean | undefined,
): JobsCommandResult {
  if (result.status === "missing-wiki") {
    return renderSharedIssue(result, json);
  }
  if (json === true) {
    return ok(`${JSON.stringify({ jobs: result.jobs }, null, 2)}\n`);
  }
  if (result.jobs.length === 0) {
    return ok("Jobs\n\nNo jobs found.\n");
  }
  return ok(["Jobs", "", ...formatJobRows(result.jobs)].join("\n") + "\n");
}

export function renderJobsShowResult(
  result: ReadJobServiceResult,
  json: boolean | undefined,
): JobsCommandResult {
  if (result.status !== "found") {
    return renderSharedIssue(result, json);
  }
  if (json === true) {
    return ok(`${JSON.stringify(result.job, null, 2)}\n`);
  }
  return ok(formatJobDetails(result.job));
}

export function renderJobsAttachResult(
  logs: JobsCommandResult,
  json: boolean | undefined,
): JobsCommandResult {
  if (logs.exitCode !== 0 || json === true) return logs;
  if (logs.stdout.length > 0) return logs;
  return { ...logs, stdout: "No log events have been written yet.\n" };
}

export function renderStreamJobLogResult(
  result: StreamJobLogServiceResult,
  json: boolean | undefined,
  write: (chunk: string) => void,
): JobsCommandResult {
  if (result.status !== "streamed") {
    return renderSharedIssue(result, json);
  }
  const summary = terminalAttachSummary(result.terminalJob);
  if (summary.length > 0) write(summary);
  return ok("");
}

export function renderCancelJobResult(
  result: CancelJobServiceResult,
  json: boolean | undefined,
): JobsCommandResult {
  if (result.status !== "cancelled") {
    return renderCancelJobIssue(result, json);
  }
  return renderOutcome(
    {
      type: "success",
      message: `cancelled job: ${result.jobId}`,
      data: { jobId: result.jobId, status: "cancelled" },
    },
    { json },
  );
}

export function renderCancelJobIssue(
  result: Exclude<CancelJobServiceResult, { status: "cancelled" }>,
  json: boolean | undefined,
): JobsCommandResult {
  if (result.status === "missing-wiki") return missingWiki(json);
  if (result.status === "missing-job") return missingJob(result.jobId, json);
  return renderOutcome(
    {
      type: "noop",
      message: `job already ${result.jobStatus}: ${result.jobId}`,
      data: { jobId: result.jobId, status: result.jobStatus },
    },
    { json },
  );
}

export function renderJobLog(
  result: ReadJobLogServiceResult,
  json: boolean | undefined,
): JobsCommandResult {
  if (result.status === "found") {
    return ok(result.contents);
  }
  if (result.status === "read-error") {
    return renderOutcome(
      { type: "error", message: result.message },
      { json },
    );
  }
  return renderSharedIssue(result, json);
}

function ok(stdout: string): JobsCommandResult {
  return { stdout, stderr: "", exitCode: 0 };
}

export function renderSharedIssue(
  result: MissingWikiResult | MissingJobResult,
  json: boolean | undefined,
): JobsCommandResult {
  if (result.status === "missing-job") return missingJob(result.jobId, json);
  return missingWiki(json);
}

function missingWiki(json: boolean | undefined): JobsCommandResult {
  return renderError(
    new UserFacingError(
      "no .almanac/ found in this directory or any parent",
      {
        outcome: "needs-action",
        fix: "run: almanac init",
      },
    ),
    { json },
  );
}

function missingJob(
  jobId: string,
  json: boolean | undefined,
): JobsCommandResult {
  return renderOutcome(
    { type: "error", message: `job not found: ${jobId}` },
    { json },
  );
}
