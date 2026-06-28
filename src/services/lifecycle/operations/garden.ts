import type { OperationSpec } from "./spec.js";
import { findNearestAlmanacDir } from "../../../paths.js";
import { MissingWikiError } from "./errors.js";
import type {
  JobWorkerProgram,
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundJob,
  StartForegroundJob,
} from "./types.js";
import type { JobAgentRunner } from "../../jobs/runtime/agent-runner.js";
import type { IsPidAlive } from "../../../shared/pid-liveness.js";
import { createOperationRunSpec, runOperationProcess } from "./run.js";

export interface GardenOperationOptions {
  cwd: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  context?: string;
  jobId?: string;
  onEvent?: (event: import("../../../shared/agent-runtime/events.js").AgentRuntimeEvent) => void | Promise<void>;
  startForeground?: StartForegroundJob;
  startBackground?: StartBackgroundJob;
  workerProgram: JobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: JobAgentRunner;
}

export async function createGardenRunSpec(args: {
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
}): Promise<OperationSpec> {
  return createOperationRunSpec({
    operation: "garden",
    promptName: "operations/garden",
    provider: args.provider,
    repoRoot: args.repoRoot,
    context: args.context,
    targetKind: "wiki",
    targetPaths: [`${args.repoRoot}/.almanac`],
  });
}

export async function runGardenOperation(
  options: GardenOperationOptions,
): Promise<OperationRunResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) throw new MissingWikiError();
  const spec = await createGardenRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
  });

  return runOperationProcess({
    repoRoot,
    spec,
    background: options.background !== false,
    jobId: options.jobId,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
    workerProgram: options.workerProgram,
    workerEnvironment: options.workerEnvironment,
    pid: options.pid,
    isPidAlive: options.isPidAlive,
    agentRunner: options.agentRunner,
  });
}
