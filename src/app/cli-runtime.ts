import { createAgentRuntimeJobRunner } from "../agent/runtime/job-runner.js";
import { startDetachedJobWorkerProcess } from "../platform/jobs/worker-process.js";
import { pathsEqualOnCurrentPlatform } from "../platform/path-case.js";
import { isLocalPidAlive } from "../platform/process.js";
import { loadBundledPrompt } from "../platform/prompts.js";
import { createPlatformAbsorbSourceResolver } from "../platform/sources/absorb.js";
import { createPlatformSyncTranscriptRuntime } from "../platform/transcripts/runtime.js";
import { startBackgroundJob } from "../services/jobs/runtime/background-start.js";
import type { AgentRuntimeRunner } from "../shared/agent-runtime/runner.js";
import type {
  LifecycleAbsorbSourceResolver,
  LifecycleOperationBackgroundStarter,
  LifecyclePromptLoader,
} from "../services/lifecycle/index.js";
import type { PathEquality } from "../shared/path-equality.js";
import type { IsPidAlive } from "../shared/pid-liveness.js";
import type { SyncTranscriptRuntime } from "../shared/transcripts.js";

export interface CliRuntime {
  workerEnvironment: NodeJS.ProcessEnv;
  isPidAlive: IsPidAlive;
  agentRunner: AgentRuntimeRunner;
  startBackground: LifecycleOperationBackgroundStarter;
  resolveAbsorbSource: LifecycleAbsorbSourceResolver;
  loadPrompt: LifecyclePromptLoader;
  transcriptRuntime: SyncTranscriptRuntime;
  registryPathEquals: PathEquality;
}

export function createCliRuntime(options: {
  environment: NodeJS.ProcessEnv;
}): CliRuntime {
  return {
    workerEnvironment: options.environment,
    isPidAlive: isLocalPidAlive,
    agentRunner: createAgentRuntimeJobRunner({
      environment: options.environment,
    }),
    startBackground: startCliBackgroundJob,
    resolveAbsorbSource: createPlatformAbsorbSourceResolver(),
    loadPrompt: loadBundledPrompt,
    transcriptRuntime: createPlatformSyncTranscriptRuntime(),
    registryPathEquals: pathsEqualOnCurrentPlatform,
  };
}

const startCliBackgroundJob: LifecycleOperationBackgroundStarter = (options) =>
  startBackgroundJob({
    ...options,
    startWorker: startDetachedJobWorkerProcess,
  });
