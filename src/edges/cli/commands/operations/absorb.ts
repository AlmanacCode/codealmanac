import {
  runAbsorbOperationWorkflow,
  type AbsorbOperationWorkflowOptions,
  type LifecycleAbsorbSourceResolver,
  type LifecycleJobWorkerProgram,
  type LifecycleOperationBackgroundStarter,
  type LifecycleOperationEventHandler,
  type LifecycleOperationForegroundStarter,
  type LifecyclePromptLoader,
} from "../../../../services/lifecycle/index.js";
import type { AgentRuntimeRunner } from "../../../../shared/agent-runtime/runner.js";
import type { IsPidAlive } from "../../../../shared/pid-liveness.js";
import {
  renderWorkflowResult,
  type OperationCommandResult,
} from "./render.js";

export type { OperationCommandResult } from "./render.js";

export interface AbsorbCommandOptions {
  cwd: string;
  inputs: string[];
  json?: boolean;
  using?: string;
  foreground?: boolean;
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

export async function runAbsorbCommand(
  options: AbsorbCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runAbsorbOperationWorkflow(toAbsorbOperationWorkflowOptions(options)),
    options.json,
  );
}

export const runIngestCommand = runAbsorbCommand;

function toAbsorbOperationWorkflowOptions(
  options: AbsorbCommandOptions,
): AbsorbOperationWorkflowOptions {
  return {
    cwd: options.cwd,
    inputs: options.inputs,
    using: options.using,
    foreground: options.foreground,
    json: options.json,
    yes: options.yes,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
    workerProgram: options.workerProgram,
    workerEnvironment: options.workerEnvironment,
    pid: options.pid,
    isPidAlive: options.isPidAlive,
    agentRunner: options.agentRunner,
    loadPrompt: options.loadPrompt,
    resolveSource: options.resolveSource,
  };
}
