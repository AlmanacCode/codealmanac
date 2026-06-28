import {
  runInitOperationWorkflow,
  type InitOperationWorkflowOptions,
  type LifecycleJobWorkerProgram,
  type LifecycleOperationBackgroundStarter,
  type LifecycleOperationEventHandler,
  type LifecycleOperationForegroundStarter,
  type LifecyclePromptLoader,
} from "../../../../services/lifecycle/index.js";
import type { AgentRuntimeRunner } from "../../../../shared/agent-runtime/runner.js";
import type { PathEquality } from "../../../../shared/path-equality.js";
import type { IsPidAlive } from "../../../../shared/pid-liveness.js";
import {
  renderWorkflowResult,
  type OperationCommandResult,
} from "./render.js";

export type { OperationCommandResult } from "./render.js";

export interface InitCommandOptions {
  cwd: string;
  json?: boolean;
  using?: string;
  background?: boolean;
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

export async function runInitCommand(
  options: InitCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runInitOperationWorkflow(toInitOperationWorkflowOptions(options)),
    options.json,
  );
}

function toInitOperationWorkflowOptions(
  options: InitCommandOptions,
): InitOperationWorkflowOptions {
  return {
    cwd: options.cwd,
    using: options.using,
    background: options.background,
    json: options.json,
    force: options.force,
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
    registryPathEquals: options.registryPathEquals,
  };
}
