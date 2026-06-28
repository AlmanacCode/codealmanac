import { homedir } from "node:os";

import { createCliRuntime } from "../../app/cli-runtime.js";
import { currentCliNodeProgram } from "./current-cli.js";

export interface SyncRuntimeInput {
  cwd: string;
  homeDir: string;
  workerProgram: ReturnType<typeof currentCliNodeProgram>;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  isPidAlive: (pid: number) => boolean;
  agentRunner: ReturnType<typeof createCliRuntime>["agentRunner"];
  loadPrompt: ReturnType<typeof createCliRuntime>["loadPrompt"];
  transcriptRuntime: ReturnType<typeof createCliRuntime>["transcriptRuntime"];
  startBackground: ReturnType<typeof createCliRuntime>["startBackground"];
}

export type SyncStatusRuntimeInput = Omit<SyncRuntimeInput, "startBackground">;

export function syncRuntimeInput(): SyncRuntimeInput {
  const runtime = createCliRuntime({ environment: process.env });
  return {
    cwd: process.cwd(),
    homeDir: homedir(),
    workerProgram: currentCliNodeProgram(),
    workerEnvironment: runtime.workerEnvironment,
    pid: process.pid,
    isPidAlive: runtime.isPidAlive,
    agentRunner: runtime.agentRunner,
    loadPrompt: runtime.loadPrompt,
    transcriptRuntime: runtime.transcriptRuntime,
    startBackground: runtime.startBackground,
  };
}

export function syncStatusRuntimeInput(): SyncStatusRuntimeInput {
  const runtimeInput = syncRuntimeInput();
  return {
    cwd: runtimeInput.cwd,
    homeDir: runtimeInput.homeDir,
    workerProgram: runtimeInput.workerProgram,
    workerEnvironment: runtimeInput.workerEnvironment,
    pid: runtimeInput.pid,
    isPidAlive: runtimeInput.isPidAlive,
    agentRunner: runtimeInput.agentRunner,
    loadPrompt: runtimeInput.loadPrompt,
    transcriptRuntime: runtimeInput.transcriptRuntime,
  };
}
