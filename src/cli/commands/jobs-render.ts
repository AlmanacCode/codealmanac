import { UserFacingError } from "../../errors.js";
import type {
  CancelJobServiceResult,
  MissingJobResult,
  MissingWikiResult,
  ReadJobLogServiceResult,
} from "../../services/jobs/index.js";
import { renderError, renderOutcome } from "../outcome.js";
import type { JobsCommandResult } from "./jobs.js";

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
    return { stdout: result.contents, stderr: "", exitCode: 0 };
  }
  if (result.status === "read-error") {
    return renderOutcome(
      { type: "error", message: result.message },
      { json },
    );
  }
  return renderSharedIssue(result, json);
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
