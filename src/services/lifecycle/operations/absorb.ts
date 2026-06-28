import type { OperationSpec } from "../../../shared/operation-spec.js";
import type { FinalOutputSpec } from "../../../shared/agent-runtime/final-output.js";
import { findNearestAlmanacDir } from "../../../stores/wiki-files/repo-location.js";
import { MissingWikiError } from "./errors.js";
import type {
  JobWorkerProgram,
  OperationProviderSelection,
  OperationPromptLoader,
  OperationRunResult,
  StartBackgroundJob,
  StartForegroundJob,
} from "./types.js";
import type { JobAgentRunner } from "../../jobs/runtime/agent-runner.js";
import type { IsPidAlive } from "../../../shared/pid-liveness.js";
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
  onEvent?: (event: import("../../../shared/agent-runtime/events.js").AgentRuntimeEvent) => void | Promise<void>;
  startForeground?: StartForegroundJob;
  startBackground?: StartBackgroundJob;
  workerProgram: JobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: JobAgentRunner;
  loadPrompt: OperationPromptLoader;
}

export async function createAbsorbRunSpec(args: {
  repoRoot: string;
  context: string;
  provider?: OperationProviderSelection;
  targetKind?: string;
  targetPaths?: string[];
  networkAccess?: boolean;
  output?: FinalOutputSpec;
  loadPrompt: OperationPromptLoader;
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
    loadPrompt: args.loadPrompt,
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
    loadPrompt: options.loadPrompt,
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
