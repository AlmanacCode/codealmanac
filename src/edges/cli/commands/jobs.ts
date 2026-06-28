import {
  cancelJob,
  listJobs,
  readJob,
  readJobLog,
  streamJobLog,
} from "../../../services/jobs/index.js";
import type {
  CancelJobRequest,
  JobLogRequest,
  JobRequest,
  JobsRequest,
  StreamJobLogRequest,
} from "../../../services/jobs/index.js";
import {
  renderCancelJobResult,
  renderJobsAttachResult,
  renderJobsListResult,
  renderJobsShowResult,
  renderJobLog,
  renderStreamJobLogResult,
} from "./jobs-render.js";

export interface JobsListCommandOptions {
  cwd: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive: (pid: number) => boolean;
}

export interface JobByIdCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive: (pid: number) => boolean;
}

export interface JobLogCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
}

export interface JobCancelCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
  now?: () => Date;
  signalProcess: (pid: number, signal: NodeJS.Signals) => void;
}

export interface JobAttachStreamCommandOptions {
  cwd: string;
  jobId: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive: (pid: number) => boolean;
  write: (chunk: string) => void;
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
  return renderJobsListResult(
    await listJobs(toJobsRequest(options)),
    options.json,
  );
}

export async function runJobsShow(
  options: JobByIdCommandOptions,
): Promise<JobsCommandResult> {
  return renderJobsShowResult(await readJob(toJobRequest(options)), options.json);
}

export async function runJobsLogs(
  options: JobLogCommandOptions,
): Promise<JobsCommandResult> {
  const result = await readJobLog(toJobLogRequest(options));
  return renderJobLog(result, options.json);
}

export async function runJobsAttach(
  options: JobLogCommandOptions,
): Promise<JobsCommandResult> {
  return renderJobsAttachResult(await runJobsLogs(options), options.json);
}

export async function streamJobsAttach(
  options: JobAttachStreamCommandOptions,
): Promise<JobsCommandResult> {
  const result = await streamJobLog(toStreamJobLogRequest(options));
  return renderStreamJobLogResult(result, options.json, options.write);
}

export async function runJobsCancel(
  options: JobCancelCommandOptions,
): Promise<JobsCommandResult> {
  return renderCancelJobResult(
    await cancelJob(toCancelJobRequest(options)),
    options.json,
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

function toJobLogRequest(options: JobLogCommandOptions): JobLogRequest {
  return {
    cwd: options.cwd,
    jobId: options.jobId,
  };
}

function toStreamJobLogRequest(
  options: JobAttachStreamCommandOptions,
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
