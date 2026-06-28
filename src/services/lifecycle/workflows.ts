import type {
  AgentRuntimeEvent,
  AgentRuntimeResult,
} from "../../shared/agent-runtime/events.js";
import type { JobRecord } from "../../stores/jobs/types.js";
import type { JobWorkerProgram } from "../../shared/worker-program.js";
import type { IsPidAlive } from "../../shared/pid-liveness.js";
import type { JobAgentRunner } from "../jobs/runtime/agent-runner.js";
import type { AbsorbInputSource } from "./absorb/input-source.js";
import type { SourceRef } from "./absorb/source-ref.js";
import type { OperationSpec } from "./operations/spec.js";
import * as absorb from "./absorb/index.js";
import * as operations from "./operations/index.js";
import {
  type LifecycleOperationRunResult,
  lifecycleOperationRunResultFromOperation,
} from "./operation-results.js";

export type LifecycleOperationKind = "init" | "absorb" | "garden";
export type LifecycleJobWorkerProgram = JobWorkerProgram;

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
  agentRunner: JobAgentRunner;
}

export interface LifecycleBackgroundStartRequest {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  workerProgram: LifecycleJobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
}

export interface LifecycleForegroundStartResult {
  jobId: string;
  record: JobRecord;
  result: AgentRuntimeResult;
}

export interface LifecycleBackgroundStartResult {
  jobId: string;
  record: JobRecord;
  childPid: number;
}

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
  context: string;
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
  agentRunner: JobAgentRunner;
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
  agentRunner: JobAgentRunner;
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
  agentRunner: JobAgentRunner;
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
  agentRunner: JobAgentRunner;
}

export type LifecycleOperationWorkflowResult =
  | {
      status: "completed";
      operation: LifecycleOperationKind;
      result: LifecycleOperationRunResult;
    }
  | { status: "json-foreground-unsupported" }
  | { status: "failed"; error: unknown };

type ProviderResolution =
  | { status: "resolved"; value: operations.OperationProviderSelection }
  | { status: "failed"; error: unknown };

export async function runInitOperationWorkflow(
  options: InitOperationWorkflowOptions,
): Promise<LifecycleOperationWorkflowResult> {
  const provider = await resolveProvider(options);
  if (provider.status === "failed") return provider;

  const background = options.background === true;
  if (options.json === true && !background) {
    return { status: "json-foreground-unsupported" };
  }

  try {
    return {
      status: "completed",
      operation: "init",
      result: lifecycleOperationRunResultFromOperation(
        await operations.build({
          cwd: options.cwd,
          provider: provider.value,
          background,
          context: options.context,
          force: options.force,
          onEvent: options.onEvent,
          startForeground: options.startForeground,
          startBackground: options.startBackground,
          workerProgram: options.workerProgram,
          workerEnvironment: options.workerEnvironment,
          pid: options.pid,
          isPidAlive: options.isPidAlive,
          agentRunner: options.agentRunner,
        }),
      ),
    };
  } catch (error: unknown) {
    return { status: "failed", error };
  }
}

export async function runAbsorbOperationWorkflow(
  options: AbsorbOperationWorkflowOptions,
): Promise<LifecycleOperationWorkflowResult> {
  const provider = await resolveProvider(options);
  if (provider.status === "failed") return provider;
  if (options.json === true && options.foreground === true) {
    return { status: "json-foreground-unsupported" };
  }

  try {
    const started = await absorb.startRun({
      ...options,
      provider: provider.value,
    });
    return {
      status: "completed",
      operation: "absorb",
      result: lifecycleOperationRunResultFromOperation(started.result),
    };
  } catch (error: unknown) {
    return { status: "failed", error };
  }
}

export async function runPreparedAbsorbOperationWorkflow(
  options: PreparedAbsorbOperationWorkflowOptions,
): Promise<LifecycleOperationWorkflowResult> {
  const provider = await resolveProvider(options);
  if (provider.status === "failed") return provider;

  try {
    return {
      status: "completed",
      operation: "absorb",
      result: lifecycleOperationRunResultFromOperation(
        await operations.absorb({
          cwd: options.cwd,
          provider: provider.value,
          background: true,
          context: options.context,
          targetKind: options.targetKind,
          targetPaths: options.targetPaths,
          networkAccess: options.networkAccess,
          startBackground: options.startBackground,
          workerProgram: options.workerProgram,
          workerEnvironment: options.workerEnvironment,
          pid: options.pid,
          isPidAlive: options.isPidAlive,
          agentRunner: options.agentRunner,
        }),
      ),
    };
  } catch (error: unknown) {
    return { status: "failed", error };
  }
}

export async function runGardenOperationWorkflow(
  options: GardenOperationWorkflowOptions,
): Promise<LifecycleOperationWorkflowResult> {
  const provider = await resolveProvider(options);
  if (provider.status === "failed") return provider;
  if (options.json === true && options.foreground === true) {
    return { status: "json-foreground-unsupported" };
  }

  try {
    return {
      status: "completed",
      operation: "garden",
      result: lifecycleOperationRunResultFromOperation(
        await operations.garden({
          cwd: options.cwd,
          provider: provider.value,
          background: options.foreground !== true,
          onEvent: options.onEvent,
          startForeground: options.startForeground,
          startBackground: options.startBackground,
          workerProgram: options.workerProgram,
          workerEnvironment: options.workerEnvironment,
          pid: options.pid,
          isPidAlive: options.isPidAlive,
          agentRunner: options.agentRunner,
        }),
      ),
    };
  } catch (error: unknown) {
    return { status: "failed", error };
  }
}

export function parseLifecycleProviderSelection(
  value: string | undefined,
): operations.OperationProviderSelection {
  return operations.parseUsing(value);
}

async function resolveProvider(options: {
  cwd: string;
  using?: string;
}): Promise<ProviderResolution> {
  try {
    return {
      status: "resolved",
      value: await operations.resolveProvider({
        cwd: options.cwd,
        using: options.using,
      }),
    };
  } catch (error: unknown) {
    return { status: "failed", error };
  }
}
