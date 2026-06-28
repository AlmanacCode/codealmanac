import type { OperationSpec } from "./spec.js";
import type { FinalOutputSpec } from "../../../agent/runtime/final-output.js";
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
import { createOperationRunSpec, runOperationProcess } from "./run.js";

export interface AbsorbOperationOptions {
  cwd: string;
  context: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  targetKind?: string;
  targetPaths?: string[];
  networkAccess?: boolean;
  output?: FinalOutputSpec;
  jobId?: string;
  onEvent?: (event: import("../../../agent/runtime/events.js").AgentRuntimeEvent) => void | Promise<void>;
  startForeground?: StartForegroundJob;
  startBackground?: StartBackgroundJob;
  workerProgram: JobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  agentRunner: JobAgentRunner;
}

export async function createAbsorbRunSpec(args: {
  repoRoot: string;
  context: string;
  provider?: OperationProviderSelection;
  targetKind?: string;
  targetPaths?: string[];
  networkAccess?: boolean;
  output?: FinalOutputSpec;
}): Promise<OperationSpec> {
  return createOperationRunSpec({
    operation: "absorb",
    promptName: "operations/absorb",
    provider: args.provider,
    repoRoot: args.repoRoot,
    context: args.context,
    targetKind: args.targetKind,
    targetPaths: args.targetPaths,
    networkAccess: args.networkAccess,
    output: args.output,
  });
}

export async function runAbsorbOperation(
  options: AbsorbOperationOptions,
): Promise<OperationRunResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) throw new MissingWikiError();
  const spec = await createAbsorbRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
    targetKind: options.targetKind,
    targetPaths: options.targetPaths,
    networkAccess: options.networkAccess,
    output: options.output,
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
    agentRunner: options.agentRunner,
  });
}
