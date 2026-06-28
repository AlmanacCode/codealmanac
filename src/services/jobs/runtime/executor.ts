import type { AgentRuntimeResult } from "../../../shared/agent-runtime/events.js";
import type { OperationSpec } from "../../lifecycle/operations/spec.js";
import { createJobEventLogger } from "./events.js";
import { finishUnlessCancelled } from "./finalization.js";
import {
  collectJobWikiEffects,
  reindexSuccessfulJob,
  snapshotJobWiki,
} from "./wiki-effects.js";
import {
  resolveJobLogPath,
  resolveJobRecordPath,
} from "../../../stores/jobs/records.js";
import type {
  JobOperationOutput,
  JobPageChanges,
  JobRecord,
  JobSummary,
} from "../../../stores/jobs/types.js";
import type { JobAgentEventHandler, JobAgentRunner } from "./agent-runner.js";

export interface StartJobResult {
  jobId: string;
  record: JobRecord;
  result: AgentRuntimeResult;
}

export interface ExecuteStartedJobOptions {
  repoRoot: string;
  spec: OperationSpec;
  record: JobRecord;
  now: () => Date;
  onEvent?: JobAgentEventHandler;
  agentRunner: JobAgentRunner;
}

export async function executeStartedJob(
  options: ExecuteStartedJobOptions,
): Promise<StartJobResult> {
  const jobId = options.record.id;
  const recordPath = await resolveJobRecordPath(options.repoRoot, jobId);
  const logPath = await resolveJobLogPath(options.repoRoot, jobId);
  const started = options.record;
  const now = options.now;

  const events = createJobEventLogger({
    logPath,
    jobId,
    now,
    recordPath,
    fallbackRecord: started,
    observer: options.onEvent,
  });

  let result: AgentRuntimeResult;
  let finalRecord: JobRecord;
  let summary: JobSummary | undefined;
  let pageChanges: JobPageChanges | undefined;
  let operationOutput: JobOperationOutput | undefined;
  try {
    const wikiSnapshot = await snapshotJobWiki(options.repoRoot);
    try {
      result = await options.agentRunner(options.spec, { onEvent: events.onEvent });
    } catch (err: unknown) {
      result = {
        success: false,
        result: "",
        error: err instanceof Error ? err.message : String(err),
      };
      await events.appendError(result.error ?? "unknown error");
    }
    await events.waitForWrites();

    const effects = await collectJobWikiEffects({
      snapshot: wikiSnapshot,
      jobId,
      result,
    });
    summary = effects.summary;
    pageChanges = effects.pageChanges;
    operationOutput = effects.operationOutput;
    if (result.success) {
      await reindexSuccessfulJob(options.repoRoot);
    }
    finalRecord = await finishUnlessCancelled({
      recordPath,
      fallback: started,
      status: result.success ? "done" : "failed",
      finishedAt: now(),
      providerSessionId: result.providerSessionId,
      summary,
      pageChanges,
      operationOutput,
      error: result.error,
      failure: result.failure,
    });
  } catch (err: unknown) {
    result = {
      success: false,
      result: "",
      error: err instanceof Error ? err.message : String(err),
    };
    try {
      await events.appendError(result.error ?? "unknown error");
    } catch {
      // The job record is the source of truth; do not let a broken log write
      // prevent terminal status recording.
    }
    await events.waitForWrites();
    finalRecord = await finishUnlessCancelled({
      recordPath,
      fallback: started,
      status: "failed",
      finishedAt: now(),
      summary,
      pageChanges,
      operationOutput,
      error: result.error,
      failure: result.failure,
    });
  }

  if (finalRecord.status === "cancelled" && result.success) {
    result = {
      success: false,
      result: "",
      error: "job cancelled before final status",
    };
  }
  return { jobId, record: finalRecord, result };
}
