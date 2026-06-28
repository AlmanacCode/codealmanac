import type { AgentRuntimeProviderId } from "../../../agent/runtime/types.js";
import type { OperationSpec } from "./spec.js";
import type { AgentRuntimeEvent } from "../../../agent/runtime/events.js";
import type { JobWorkerProgram } from "../../../platform/jobs/worker-process.js";
import type { StartBackgroundJobResult } from "../../jobs/runtime/background-start.js";
import type { StartJobResult } from "../../jobs/runtime/executor.js";

export type { JobWorkerProgram };

export interface OperationProviderSelection {
  id: AgentRuntimeProviderId;
  model?: string;
  effort?: string;
}

export type OperationMode = "foreground" | "background";

export interface OperationRunResult {
  mode: OperationMode;
  jobId: string;
  foreground?: StartJobResult;
  background?: StartBackgroundJobResult;
}

export type StartForegroundJob = (options: {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  pid: number;
  workerEnvironment: NodeJS.ProcessEnv;
  onEvent?: (event: AgentRuntimeEvent) => void | Promise<void>;
}) => Promise<StartJobResult>;

export type StartBackgroundJob = (options: {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  workerProgram: JobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
}) => Promise<StartBackgroundJobResult>;
