import type { HarnessFailure } from "../../harness/events.js";
import {
  type LifecycleOperationRunResult,
  type LifecycleOperationWorkflowResult,
} from "../../services/lifecycle/index.js";
import { renderError, renderOutcome } from "../outcome.js";

export interface OperationCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderWorkflowResult(
  result: LifecycleOperationWorkflowResult,
  json: boolean | undefined,
): OperationCommandResult {
  switch (result.status) {
    case "completed":
      return renderOperationResult(result.operation, result.result, json);
    case "json-foreground-unsupported":
      return renderJsonForegroundError(json);
    case "failed":
      return renderError(result.error, { json });
  }
}

function renderOperationResult(
  operation: string,
  result: LifecycleOperationRunResult,
  json: boolean | undefined,
): OperationCommandResult {
  const job = result.job;
  const status = job.status;
  const foregroundResult = result.foreground;
  if (
    result.mode === "foreground" &&
    (foregroundResult?.success === false || status === "failed")
  ) {
    const failure = foregroundResult?.failure ?? job.failure;
    return renderOutcome(
      {
        type: "error",
        message: renderOperationFailureMessage({
          operation,
          jobId: result.jobId,
          error: foregroundResult?.error,
          failure,
        }),
        data: {
          operation,
          jobId: result.jobId,
          mode: result.mode,
          status,
          pid: job.pid,
          logPath: job.logPath,
          error: foregroundResult?.error,
          failure,
        },
      },
      { json },
    );
  }

  const message = result.mode === "background"
    ? `${operation} started: ${result.jobId}`
    : `${operation} finished: ${result.jobId}`;
  const stdout = operation === "init" && result.mode === "foreground"
    ? `${message}\nBrowse the wiki: almanac serve\n`
    : undefined;

  return renderOutcome(
    {
      type: "success",
      message,
      data: {
        operation,
        jobId: result.jobId,
        mode: result.mode,
        status,
        pid: job.pid,
        logPath: job.logPath,
      },
    },
    { json, stdout },
  );
}

function renderOperationFailureMessage(args: {
  operation: string;
  jobId: string;
  error?: string;
  failure?: HarnessFailure;
}): string {
  const lines = [`${args.operation} failed: ${args.jobId}`];
  if (args.failure !== undefined) {
    lines.push(`Reason: ${args.failure.message}`);
    if (args.failure.fix !== undefined) lines.push(`Fix: ${args.failure.fix}`);
    return lines.join("\n");
  }
  if (args.error !== undefined) lines[0] += `: ${args.error}`;
  return lines.join("\n");
}

function renderJsonForegroundError(
  json: boolean | undefined,
): OperationCommandResult {
  return renderOutcome(
    {
      type: "error",
      message: "--json is only supported for background job start responses",
    },
    { json },
  );
}
