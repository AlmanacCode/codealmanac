import type { AgentRuntimeEvent } from "../../shared/agent-runtime/events.js";
import { createAgentRuntimeJobRunner } from "../../agent/runtime/job-runner.js";
import { drainQueuedJobs } from "../../services/jobs/runtime/queue-drain.js";
import type { JobAgentRunner } from "../../services/jobs/runtime/agent-runner.js";
import type { IsPidAlive } from "../../shared/pid-liveness.js";

export interface RunJobWorkerOptions {
  repoRoot: string;
  now?: () => Date;
  pid: number;
  isPidAlive: IsPidAlive;
  workerEnvironment: NodeJS.ProcessEnv;
  onEvent?: (event: AgentRuntimeEvent) => void | Promise<void>;
  agentRunner?: JobAgentRunner;
}

export async function runJobWorker(
  options: RunJobWorkerOptions,
): Promise<void> {
  await drainQueuedJobs({
    repoRoot: options.repoRoot,
    now: options.now,
    pid: options.pid,
    isPidAlive: options.isPidAlive,
    onEvent: options.onEvent,
    agentRunner: options.agentRunner ??
      createAgentRuntimeJobRunner({ environment: options.workerEnvironment }),
  });
}
