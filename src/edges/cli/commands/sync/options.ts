import type { AgentRuntimeRunner } from "../../../../shared/agent-runtime/runner.js";
import type { IsPidAlive } from "../../../../shared/pid-liveness.js";
import type { SyncWorkflowOptions } from "../../../../services/sync/index.js";

export interface SyncCommandRuntimeOptions {
  cwd: string;
  now?: Date;
  homeDir: string;
  configPath?: string;
  startBackground?: SyncWorkflowOptions["startBackground"];
  workerProgram: SyncWorkflowOptions["workerProgram"];
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: IsPidAlive;
  agentRunner: AgentRuntimeRunner;
  loadPrompt: SyncWorkflowOptions["loadPrompt"];
  transcriptRuntime: SyncWorkflowOptions["transcriptRuntime"];
}

export interface SyncCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SyncWorkflowCommandOptions extends SyncCommandRuntimeOptions {
  mode?: "sync" | "status";
  from?: string;
  quiet?: string;
  using?: string;
}

export function toSyncWorkflowOptions(
  options: SyncWorkflowCommandOptions,
): SyncWorkflowOptions {
  return {
    mode: options.mode,
    from: options.from,
    quiet: options.quiet,
    using: options.using,
    now: options.now,
    homeDir: options.homeDir,
    configPath: options.configPath,
    startBackground: options.startBackground,
    workerProgram: options.workerProgram,
    workerEnvironment: options.workerEnvironment,
    pid: options.pid,
    isPidAlive: options.isPidAlive,
    agentRunner: options.agentRunner,
    loadPrompt: options.loadPrompt,
    transcriptRuntime: options.transcriptRuntime,
  };
}
