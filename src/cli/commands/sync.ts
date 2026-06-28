import {
  runSyncWorkflow,
  type SyncWorkflowOptions,
} from "../../services/sync/index.js";
import type { JobAgentRunner } from "../../services/jobs/runtime/agent-runner.js";
import { renderSyncResult } from "./sync-render.js";

export interface SyncCommandOptions {
  cwd: string;
  mode?: "sync" | "status";
  from?: string;
  quiet?: string;
  using?: string;
  json?: boolean;
  now?: Date;
  homeDir: string;
  configPath?: string;
  startBackground?: SyncWorkflowOptions["startBackground"];
  workerProgram: SyncWorkflowOptions["workerProgram"];
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  agentRunner: JobAgentRunner;
  transcriptRuntime: SyncWorkflowOptions["transcriptRuntime"];
}

export interface SyncCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runSyncCommand(
  options: SyncCommandOptions,
): Promise<SyncCommandResult> {
  return renderSyncResult(
    await runSyncWorkflow(toSyncWorkflowOptions(options)),
    options.json,
  );
}

function toSyncWorkflowOptions(
  options: SyncCommandOptions,
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
    agentRunner: options.agentRunner,
    transcriptRuntime: options.transcriptRuntime,
  };
}
