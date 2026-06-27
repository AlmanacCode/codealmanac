import type {
  HarnessEvent,
  HarnessResult,
} from "../../harness/events.js";
import type { JobRecord } from "../../jobs/types.js";
import type { AbsorbInputSource } from "../../absorb/input-source.js";
import type { SourceRef } from "../../absorb/source-ref.js";
import type { OperationSpec } from "../../operations/spec.js";
import * as absorb from "../../absorb/index.js";
import * as operations from "../../operations/index.js";
import {
  type LifecycleOperationRunResult,
  lifecycleOperationRunResultFromOperation,
} from "./operation-results.js";

export type LifecycleOperationKind = "init" | "absorb" | "garden";

export type LifecycleOperationEventHandler = (
  event: HarnessEvent,
) => void | Promise<void>;

export interface LifecycleForegroundStartRequest {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
  onEvent?: LifecycleOperationEventHandler;
}

export interface LifecycleBackgroundStartRequest {
  repoRoot: string;
  spec: OperationSpec;
  jobId?: string;
}

export interface LifecycleForegroundStartResult {
  jobId: string;
  record: JobRecord;
  result: HarnessResult;
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
  using?: string;
  background?: boolean;
  json?: boolean;
  force?: boolean;
  yes?: boolean;
  onEvent?: LifecycleOperationEventHandler;
  startForeground?: LifecycleOperationForegroundStarter;
  startBackground?: LifecycleOperationBackgroundStarter;
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
          context: initContext(options),
          force: options.force,
          onEvent: options.onEvent,
          startForeground: options.startForeground,
          startBackground: options.startBackground,
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

function initContext(options: InitOperationWorkflowOptions): string {
  return [
    "Command context:",
    `- Command: init`,
    `- Force requested: ${options.force === true ? "yes" : "no"}`,
    `- Non-interactive confirmation: ${options.yes === true ? "yes" : "no"}`,
  ].join("\n");
}
