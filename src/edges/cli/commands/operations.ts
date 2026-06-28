import {
  runAbsorbOperationWorkflow,
  runGardenOperationWorkflow,
  runInitOperationWorkflow,
  type AbsorbOperationWorkflowOptions,
  type GardenOperationWorkflowOptions,
  type InitOperationWorkflowOptions,
  type LifecycleJobWorkerProgram,
  type LifecycleAbsorbSourceResolver,
  type LifecycleOperationBackgroundStarter,
  type LifecycleOperationEventHandler,
  type LifecycleOperationForegroundStarter,
  type LifecyclePromptLoader,
} from "../../../services/lifecycle/index.js";
import type { AgentRuntimeRunner } from "../../../shared/agent-runtime/runner.js";
import type { IsPidAlive } from "../../../shared/pid-liveness.js";
import {
  renderWorkflowResult,
  type OperationCommandResult,
} from "./operations-render.js";

export type { OperationCommandResult } from "./operations-render.js";

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
}

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

export interface GardenCommandOptions {
  cwd: string;
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
}

export async function runInitCommand(
  options: InitCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runInitOperationWorkflow(toInitOperationWorkflowOptions(options)),
    options.json,
  );
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

export async function runGardenCommand(
  options: GardenCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runGardenOperationWorkflow(toGardenOperationWorkflowOptions(options)),
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
  };
}

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

function toGardenOperationWorkflowOptions(
  options: GardenCommandOptions,
): GardenOperationWorkflowOptions {
  return {
    cwd: options.cwd,
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
  };
}
