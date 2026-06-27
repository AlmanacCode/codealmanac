import type { JobStatus, JobView } from "../../jobs/index.js";

export interface JobsRequest {
  cwd: string;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface JobRequest extends JobsRequest {
  jobId: string;
}

export interface StreamJobLogRequest extends JobRequest {
  write: (chunk: string) => void;
  pollMs?: number;
}

export interface CancelJobRequest extends JobRequest {
  signalProcess?: (pid: number, signal: NodeJS.Signals) => void;
}

export interface MissingWikiResult {
  status: "missing-wiki";
}

export interface MissingJobResult {
  status: "missing-job";
  jobId: string;
}

export interface ListJobsResult {
  status: "listed";
  jobs: JobView[];
}

export interface ReadJobResult {
  status: "found";
  job: JobView;
}

export interface ReadJobLogResult {
  status: "found";
  contents: string;
}

export interface ReadJobLogErrorResult {
  status: "read-error";
  message: string;
}

export type TerminalJobStatus = Extract<
  JobStatus,
  "done" | "failed" | "cancelled"
>;

export interface CancelledJobResult {
  status: "cancelled";
  jobId: string;
}

export interface AlreadyTerminalJobResult {
  status: "already-terminal";
  jobId: string;
  jobStatus: TerminalJobStatus;
}

export interface StreamedJobLogResult {
  status: "streamed";
  terminalJob: JobView;
}

export type ListJobsServiceResult = MissingWikiResult | ListJobsResult;
export type ReadJobServiceResult = MissingWikiResult | MissingJobResult | ReadJobResult;
export type ReadJobLogServiceResult =
  | MissingWikiResult
  | MissingJobResult
  | ReadJobLogResult
  | ReadJobLogErrorResult;
export type CancelJobServiceResult =
  | MissingWikiResult
  | MissingJobResult
  | AlreadyTerminalJobResult
  | CancelledJobResult;
export type StreamJobLogServiceResult =
  | MissingWikiResult
  | MissingJobResult
  | StreamedJobLogResult;
