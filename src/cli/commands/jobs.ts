import { renderOutcome } from "../outcome.js";
import {
  cancelJob,
  listJobs,
  readJob,
  readJobLog,
  streamJobLog,
} from "../../services/jobs/index.js";
import type {
  CancelJobRequest,
  JobRequest,
  JobsRequest,
  StreamJobLogRequest,
} from "../../services/jobs/index.js";
import {
  formatJobDetails,
  formatJobRows,
  terminalAttachSummary,
} from "./jobs-format.js";
import {
  renderCancelJobIssue,
  renderJobLog,
  renderSharedIssue,
} from "./jobs-render.js";

export interface JobsListCommandOptions {
  cwd: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface JobByIdCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface JobCancelCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
  now?: () => Date;
  signalProcess?: (pid: number, signal: NodeJS.Signals) => void;
}

export interface JobAttachStreamCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
  write?: (chunk: string) => void;
  pollMs?: number;
}

export interface JobsCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runJobsList(
  options: JobsListCommandOptions,
): Promise<JobsCommandResult> {
  const result = await listJobs(toJobsRequest(options));
  if (result.status === "missing-wiki") {
    return renderSharedIssue(result, options.json);
  }

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify({ jobs: result.jobs }, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  if (result.jobs.length === 0) {
    return { stdout: "Jobs\n\nNo jobs found.\n", stderr: "", exitCode: 0 };
  }
  const lines = ["Jobs", "", ...formatJobRows(result.jobs)];
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

export async function runJobsShow(
  options: JobByIdCommandOptions,
): Promise<JobsCommandResult> {
  const result = await readJob(toJobRequest(options));
  if (result.status !== "found") {
    return renderSharedIssue(result, options.json);
  }
  const view = result.job;

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(view, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout: formatJobDetails(view),
    stderr: "",
    exitCode: 0,
  };
}

export async function runJobsLogs(
  options: JobByIdCommandOptions,
): Promise<JobsCommandResult> {
  const result = await readJobLog(toJobRequest(options));
  return renderJobLog(result, options.json);
}

export async function runJobsAttach(
  options: JobByIdCommandOptions,
): Promise<JobsCommandResult> {
  const logs = await runJobsLogs(options);
  if (logs.exitCode !== 0 || options.json === true) return logs;
  return {
    ...logs,
    stdout:
      logs.stdout.length > 0
        ? logs.stdout
        : "No log events have been written yet.\n",
  };
}

export async function streamJobsAttach(
  options: JobAttachStreamCommandOptions,
): Promise<JobsCommandResult> {
  const write = options.write ?? ((chunk: string) => process.stdout.write(chunk));
  const result = await streamJobLog(toStreamJobLogRequest({ ...options, write }));
  if (result.status !== "streamed") {
    return renderSharedIssue(result, options.json);
  }
  const summary = terminalAttachSummary(result.terminalJob);
  if (summary.length > 0) write(summary);
  return { stdout: "", stderr: "", exitCode: 0 };
}

export async function runJobsCancel(
  options: JobCancelCommandOptions,
): Promise<JobsCommandResult> {
  const result = await cancelJob(toCancelJobRequest(options));
  if (result.status !== "cancelled") {
    return renderCancelJobIssue(result, options.json);
  }
  return renderOutcome(
    {
      type: "success",
      message: `cancelled job: ${result.jobId}`,
      data: { jobId: result.jobId, status: "cancelled" },
    },
    { json: options.json },
  );
}

function toJobsRequest(options: JobsListCommandOptions): JobsRequest {
  return {
    cwd: options.cwd,
    now: options.now,
    isPidAlive: options.isPidAlive,
  };
}

function toJobRequest(options: JobByIdCommandOptions): JobRequest {
  return {
    cwd: options.cwd,
    jobId: options.jobId,
    now: options.now,
    isPidAlive: options.isPidAlive,
  };
}

function toStreamJobLogRequest(
  options: JobAttachStreamCommandOptions & { write: (chunk: string) => void },
): StreamJobLogRequest {
  return {
    cwd: options.cwd,
    jobId: options.jobId,
    write: options.write,
    pollMs: options.pollMs,
    now: options.now,
    isPidAlive: options.isPidAlive,
  };
}

function toCancelJobRequest(
  options: JobCancelCommandOptions,
): CancelJobRequest {
  return {
    cwd: options.cwd,
    jobId: options.jobId,
    now: options.now,
    signalProcess: options.signalProcess,
  };
}
