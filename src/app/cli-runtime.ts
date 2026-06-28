import { createAgentRuntimeJobRunner } from "../agent/runtime/job-runner.js";
import { startDetachedJobWorkerProcess } from "../platform/jobs/worker-process.js";
import { isLocalPidAlive } from "../platform/process.js";
import { createPlatformAbsorbSourceResolver } from "../platform/sources/absorb.js";
import { createPlatformSyncTranscriptRuntime } from "../platform/transcripts/runtime.js";
import { startBackgroundJob } from "../services/jobs/runtime/background-start.js";
import type { JobAgentRunner } from "../services/jobs/runtime/agent-runner.js";
import type {
  LifecycleAbsorbSourceResolver,
  LifecycleOperationBackgroundStarter,
} from "../services/lifecycle/index.js";
import type { SyncTranscriptRuntime } from "../services/sync/index.js";
import type { IsPidAlive } from "../shared/pid-liveness.js";

export interface CliRuntime {
  workerEnvironment: NodeJS.ProcessEnv;
  isPidAlive: IsPidAlive;
  agentRunner: JobAgentRunner;
  startBackground: LifecycleOperationBackgroundStarter;
  resolveAbsorbSource: LifecycleAbsorbSourceResolver;
  transcriptRuntime: SyncTranscriptRuntime;
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
    transcriptRuntime: createPlatformSyncTranscriptRuntime(),
  };
}

const startCliBackgroundJob: LifecycleOperationBackgroundStarter = (options) =>
  startBackgroundJob({
    ...options,
    startWorker: startDetachedJobWorkerProcess,
  });
