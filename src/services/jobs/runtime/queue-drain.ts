import {
  finishJobRecord,
} from "../record-lifecycle.js";
import {
  readJobRecord,
  resolveJobRecordPath,
  readJobSpec,
  writeJobRecord,
} from "../../../stores/jobs/index.js";
import { acquireJobWorkerLock } from "../../../stores/jobs/worker-lock.js";
import { oldestQueuedJob } from "./queue.js";
import { startQueuedJob } from "./start.js";
import type { JobRecord } from "../../../stores/jobs/index.js";
import type { JobAgentEventHandler, JobAgentRunner } from "./agent-runner.js";
import type { IsPidAlive } from "../../../shared/pid-liveness.js";

export interface DrainQueuedJobsOptions {
  repoRoot: string;
  now?: () => Date;
  pid: number;
  isPidAlive: IsPidAlive;
  onEvent?: JobAgentEventHandler;
  agentRunner: JobAgentRunner;
}

export async function drainQueuedJobs(
  options: DrainQueuedJobsOptions,
): Promise<void> {
  const now = options.now ?? (() => new Date());
  while (true) {
    const lock = await acquireJobWorkerLock(options.repoRoot, now(), {
      ownerPid: options.pid,
      isPidAlive: options.isPidAlive,
    });
    if (lock === null) return;
    try {
      while (true) {
        const record = await oldestQueuedJob(options.repoRoot);
        if (record === null) break;
        try {
          const spec = await readJobSpec(options.repoRoot, record.id);
          await startQueuedJob({
            repoRoot: options.repoRoot,
            spec,
            jobId: record.id,
            now,
            pid: options.pid,
            isPidAlive: options.isPidAlive,
            onEvent: options.onEvent,
            agentRunner: options.agentRunner,
          });
        } catch (err: unknown) {
          await markQueuedJobFailed({
            repoRoot: options.repoRoot,
            record,
            now: now(),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      await lock.release();
    }
    if (await oldestQueuedJob(options.repoRoot) === null) return;
  }
}

async function markQueuedJobFailed(args: {
  repoRoot: string;
  record: JobRecord;
  now: Date;
  error: string;
}): Promise<void> {
  const recordPath = await resolveJobRecordPath(args.repoRoot, args.record.id);
  const current = await readJobRecord(recordPath);
  if (current === null || current.status !== "queued") return;
  await writeJobRecord(
    recordPath,
    finishJobRecord({
      record: current,
      status: "failed",
      finishedAt: args.now,
      error: args.error,
    }),
  );
}
