import type { AgentRuntimeEvent } from "../../shared/agent-runtime/events.js";
import type { OperationSpec } from "../../shared/operation-spec.js";
import type { OperationPromptLoader } from "../../shared/operation-prompts.js";
import type { IsPidAlive } from "../../shared/pid-liveness.js";
import type { JobWorkerProgram } from "../../shared/worker-program.js";
import type {
  AbsorbInputSource,
  SourceRef,
} from "../../shared/absorb-sources.js";
import type { AgentRuntimeRunner } from "../../shared/agent-runtime/runner.js";
import type { PathEquality } from "../../shared/path-equality.js";
import type {
  OperationBackgroundStartResult,
  OperationForegroundStartResult,
} from "./operations/types.js";
import type { LifecycleOperationRunResult } from "./operation-results.js";

export type LifecycleOperationKind = "init" | "absorb" | "garden";
export type LifecycleJobWorkerProgram = JobWorkerProgram;
export type LifecyclePromptLoader = OperationPromptLoader;

export type LifecycleOperationEventHandler = (
  event: AgentRuntimeEvent,
) => void | Promise<void>;

export interface LifecycleForegroundStartRequest {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  pid: number;
  isPidAlive: IsPidAlive;
  onEvent?: LifecycleOperationEventHandler;
  agentRunner: AgentRuntimeRunner;
}

export interface LifecycleBackgroundStartRequest {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
}

export type LifecycleForegroundStartResult = OperationForegroundStartResult;
export type LifecycleBackgroundStartResult = OperationBackgroundStartResult;

export type LifecycleOperationForegroundStarter = (
  options: LifecycleForegroundStartRequest,
) => Promise<LifecycleForegroundStartResult>;

export type LifecycleOperationBackgroundStarter = (
  options: LifecycleBackgroundStartRequest,
) => Promise<LifecycleBackgroundStartResult>;

export type LifecycleAbsorbSourceResolver = (
  ref: SourceRef,
  cwd: string,
) => Promise<AbsorbInputSource>;

export interface InitOperationWorkflowOptions {
  cwd: string;
  using?: string;
  background?: boolean;
  json?: boolean;
  force?: boolean;
  yes?: boolean;
  onEvent?: LifecycleOperationEventHandler;
  startForeground?: LifecycleOperationForegroundStarter;
  startBackground?: LifecycleOperationBackgroundStarter;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: AgentRuntimeRunner;
  loadPrompt: LifecyclePromptLoader;
  registryPathEquals?: PathEquality;
}

export interface AbsorbOperationWorkflowOptions {
  cwd: string;
  inputs: string[];
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  onEvent?: LifecycleOperationEventHandler;
  startForeground?: LifecycleOperationForegroundStarter;
  startBackground?: LifecycleOperationBackgroundStarter;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: AgentRuntimeRunner;
  loadPrompt: LifecyclePromptLoader;
  resolveSource?: LifecycleAbsorbSourceResolver;
}

export interface GardenOperationWorkflowOptions {
  cwd: string;
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  onEvent?: LifecycleOperationEventHandler;
  startForeground?: LifecycleOperationForegroundStarter;
  startBackground?: LifecycleOperationBackgroundStarter;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: AgentRuntimeRunner;
  loadPrompt: LifecyclePromptLoader;
}

export interface PreparedAbsorbOperationWorkflowOptions {
  cwd: string;
  using?: string;
  context: string;
  targetKind: string;
  targetPaths: string[];
  networkAccess?: boolean;
  startBackground?: LifecycleOperationBackgroundStarter;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: AgentRuntimeRunner;
  loadPrompt: LifecyclePromptLoader;
}

export type LifecycleOperationWorkflowResult =
  | {
      status: "completed";
      operation: LifecycleOperationKind;
      result: LifecycleOperationRunResult;
    }
  | { status: "json-foreground-unsupported" }
  | { status: "failed"; error: unknown };
