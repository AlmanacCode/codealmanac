export type JobServiceStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";
export type JobServiceDisplayStatus = JobServiceStatus | "stale";
export type JobServiceOperation = "build" | "absorb" | "garden";

export type JobServiceJsonValue =
  | string
  | number
  | boolean
  | null
  | JobServiceJsonValue[]
  | { [key: string]: JobServiceJsonValue };

export interface JobServiceUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
  totalProcessedTokens?: number;
  maxTokens?: number | null;
}

export interface JobServiceSummary {
  created: number;
  updated: number;
  archived: number;
  deleted: number;
  costUsd?: number;
  turns?: number;
  usage?: JobServiceUsage;
}

export interface JobServicePageChanges {
  version: 1;
  jobId: string;
  created: string[];
  updated: string[];
  archived: string[];
  deleted: string[];
  summary?: string;
}

export interface JobServiceOperationOutput {
  version: 1;
  contract: string;
  value: JobServiceJsonValue;
}

export interface JobServiceFailure {
  provider: string;
  message: string;
  fix?: string;
  code?: string;
  raw?: string;
  details?: Record<string, unknown>;
}

export interface JobServiceView {
  version: 1;
  id: string;
  operation: JobServiceOperation;
  status: JobServiceStatus;
  repoRoot: string;
  pid: number;
  provider: string;
  model?: string;
  providerSessionId?: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  logPath: string;
  targetKind?: string;
  targetPaths?: string[];
  summary?: JobServiceSummary;
  pageChanges?: JobServicePageChanges;
  operationOutput?: JobServiceOperationOutput;
  error?: string;
  failure?: JobServiceFailure;
  displayStatus: JobServiceDisplayStatus;
  elapsedMs: number;
}

export interface JobsRequest {
  cwd: string;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface JobRequest {
  cwd: string;
  jobId: string;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface StreamJobLogRequest {
  cwd: string;
  jobId: string;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
  write: (chunk: string) => void;
  pollMs?: number;
}

export interface CancelJobRequest {
  cwd: string;
  jobId: string;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
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
  jobs: JobServiceView[];
}

export interface ReadJobResult {
  status: "found";
  job: JobServiceView;
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
  JobServiceStatus,
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
  terminalJob: JobServiceView;
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
