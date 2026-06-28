import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: jobs and sync", () => {
  it("keeps the sync command owning its command contract", async () => {
    const syncRunCommand = await readSource(
      "src/edges/cli/commands/sync/run.ts",
    );
    const syncStatusCommand = await readSource(
      "src/edges/cli/commands/sync/status.ts",
    );
    const syncOptions = await readSource(
      "src/edges/cli/commands/sync/options.ts",
    );
    const syncRender = await readSource("src/edges/cli/commands/sync/render.ts");

    expect(existsSync(join(ROOT, "src/edges/cli/commands/sync.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/sync-render.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/sync/run.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/sync/status.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/sync/options.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/sync/render.ts"))).toBe(
      true,
    );
    for (const syncCommand of [syncRunCommand, syncStatusCommand]) {
      expect(syncCommand).not.toContain("import type { CommandResult }");
      expect(syncCommand).not.toContain("extends SyncWorkflowOptions");
      expect(syncCommand).not.toContain("renderOutcome");
      expect(syncCommand).not.toContain("renderError");
      expect(syncCommand).not.toContain("function renderSyncSummary");
      expect(syncCommand).not.toContain("sync status completed");
    }
    expect(syncOptions).toContain("homeDir: string");
    expect(syncOptions).toContain("toSyncWorkflowOptions");
    expect(syncRender).toContain("renderSyncResult");
    expect(syncRender).toContain("function renderSyncSummary");
  });

  it("keeps jobs command adapters out of job storage and process mechanics", async () => {
    const jobsServiceIndex = await readSource("src/services/jobs/index.ts");
    const jobsServiceTypes = await readSource("src/services/jobs/types.ts");
    const jobsStoreTypes = await readSource("src/stores/jobs/types.ts");
    const jobsReadService = await readSource("src/services/jobs/read.ts");
    const jobsLogService = await readSource("src/services/jobs/log-read.ts");
    const jobsCancelService = await readSource("src/services/jobs/cancel.ts");
    const jobsRecordView = await readSource("src/services/jobs/record-view.ts");
    const jobsRepoRoot = await readSource("src/services/jobs/repo-root.ts");
    const jobsServiceView = await readSource("src/services/jobs/view.ts");
    const jobsReadCommand = await readSource("src/edges/cli/commands/jobs/read.ts");
    const jobsLogCommand = await readSource("src/edges/cli/commands/jobs/logs.ts");
    const jobsCancelCommand = await readSource(
      "src/edges/cli/commands/jobs/cancel.ts",
    );
    const jobsRender = await readSource("src/edges/cli/commands/jobs/render.ts");
    const jobsRegistration = await readSource(
      "src/edges/cli/register-jobs-commands.ts",
    );
    const jobReadRegistration = await readSource(
      "src/edges/cli/register-job-read-commands.ts",
    );
    const jobLogRegistration = await readSource(
      "src/edges/cli/register-job-log-commands.ts",
    );
    const jobCancelRegistration = await readSource(
      "src/edges/cli/register-job-cancel-command.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs-format.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs-render.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs/format.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs/render.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs/read.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs/logs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/jobs/cancel.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/view.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/jobs.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/read.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/log-read.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/cancel.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/repo-root.ts"))).toBe(true);
    expect(jobsServiceIndex).not.toContain("../../jobs");
    expect(jobsServiceIndex).not.toContain("./runtime/index.js");
    expect(jobsServiceIndex).not.toContain("writeJobRecord");
    expect(jobsServiceIndex).not.toContain("startForegroundJob");
    expect(jobsServiceIndex).not.toContain("./jobs.js");
    expect(jobsServiceIndex).toContain("./read.js");
    expect(jobsServiceIndex).toContain("./log-read.js");
    expect(jobsServiceIndex).toContain("./cancel.js");
    expect(jobsServiceTypes).not.toContain("RuntimeJobView");
    expect(jobsServiceTypes).not.toContain("JobView as");
    expect(jobsServiceTypes).not.toContain("JobRequest extends JobsRequest");
    expect(jobsServiceTypes).not.toContain(
      "StreamJobLogRequest extends JobRequest",
    );
    expect(jobsServiceTypes).not.toContain("CancelJobRequest extends JobRequest");
    expect(jobsStoreTypes).not.toContain("DisplayJobStatus");
    expect(jobsStoreTypes).not.toContain("interface JobView");
    expect(jobsStoreTypes).not.toContain("displayStatus:");
    expect(jobsRecordView).toContain("export interface JobView");
    expect(jobsRecordView).toContain("displayStatus: JobDisplayStatus");
    expect(jobsRecordView).toContain("isPidAlive");
    for (const jobsCommand of [
      jobsReadCommand,
      jobsLogCommand,
      jobsCancelCommand,
    ]) {
      expect(jobsCommand).toContain("services/jobs/index.js");
      expect(jobsCommand).not.toContain("../../jobs/index");
      expect(jobsCommand).not.toContain("import type { CommandResult }");
      expect(jobsCommand).not.toContain("extends JobsOptions");
      expect(jobsCommand).toContain("JobsCommandResult");
      expect(jobsCommand).not.toContain("readJobRecord");
      expect(jobsCommand).not.toContain("writeJobRecord");
      expect(jobsCommand).not.toContain("resolveJobRecordPath");
      expect(jobsCommand).not.toContain("resolveJobLogPath");
      expect(jobsCommand).not.toContain("finishJobRecord");
      expect(jobsCommand).not.toContain("process.kill");
      expect(jobsCommand).not.toContain("process.stdout");
      expect(jobsCommand).not.toContain("JSON.stringify");
      expect(jobsCommand).not.toContain("formatJobRows");
      expect(jobsCommand).not.toContain("formatJobDetails");
      expect(jobsCommand).not.toContain("terminalAttachSummary");
      expect(jobsCommand).not.toContain("No jobs found");
      expect(jobsCommand).not.toContain("No log events");
      expect(jobsCommand).not.toContain("cancelled job");
      expect(jobsCommand).not.toContain("function formatPageChanges");
      expect(jobsCommand).not.toContain("function formatMs");
      expect(jobsCommand).not.toContain("function missingWiki");
    }
    expect(jobsReadCommand).toContain("toJobsRequest");
    expect(jobsReadCommand).toContain("toJobRequest");
    expect(jobsLogCommand).toContain("toStreamJobLogRequest");
    expect(jobsCancelCommand).toContain("toCancelJobRequest");
    expect(jobsRender).toContain("renderJobsListResult");
    expect(jobsRender).toContain("renderJobsShowResult");
    expect(jobsRender).toContain("renderStreamJobLogResult");
    expect(jobsRender).toContain("renderCancelJobResult");
    expect(jobsRegistration).toContain("registerJobReadCommands(jobs)");
    expect(jobsRegistration).toContain("registerJobLogCommands(jobs)");
    expect(jobsRegistration).toContain("registerJobCancelCommand(jobs)");
    expect(jobsRegistration).not.toContain("isLocalPidAlive");
    expect(jobsRegistration).not.toContain("signalLocalPid");
    expect(jobsRegistration).not.toContain("process.stdout");
    expect(jobReadRegistration).toContain("isLocalPidAlive");
    expect(jobReadRegistration).toContain('.command("list"');
    expect(jobReadRegistration).toContain('.command("show <run-id>"');
    expect(jobLogRegistration).toContain("isLocalPidAlive");
    expect(jobLogRegistration).toContain("write: (chunk)");
    expect(jobLogRegistration).toContain("process.stdout.write");
    expect(jobCancelRegistration).toContain("signalLocalPid");
    for (const jobsServiceSource of [
      jobsReadService,
      jobsLogService,
      jobsCancelService,
    ]) {
      expect(jobsServiceSource).not.toContain("JobView as RuntimeJobView");
      expect(jobsServiceSource).not.toContain("function jobServiceViewFromRuntime");
      expect(jobsServiceSource).not.toContain("toJobView");
      expect(jobsServiceSource).not.toContain("platform/process");
      expect(jobsServiceSource).not.toContain("readFile");
      expect(jobsServiceSource).not.toContain("resolveJobRecordPath");
      expect(jobsServiceSource).not.toContain("resolveJobLogPath");
      expect(jobsServiceSource).not.toContain("writeJobRecord");
      expect(jobsServiceSource).not.toContain("./runtime/index.js");
      expect(jobsServiceSource).toContain("stores/jobs/index.js");
    }
    expect(jobsReadService).toContain("listJobs");
    expect(jobsReadService).toContain("readJob");
    expect(jobsReadService).not.toContain("readJobLog");
    expect(jobsReadService).not.toContain("cancelJob");
    expect(jobsLogService).toContain("readJobLog");
    expect(jobsLogService).toContain("streamJobLog");
    expect(jobsLogService).not.toContain("finishJobRecord");
    expect(jobsCancelService).toContain("cancelJob");
    expect(jobsCancelService).toContain("finishJobRecord");
    expect(jobsCancelService).not.toContain("streamJobLog");
    expect(jobsRepoRoot).toContain("findNearestAlmanacDir");
    expect(jobsServiceView).not.toContain("platform/process");
    expect(jobsServiceView).not.toContain("./runtime/index.js");
    expect(jobsServiceView).not.toContain("RuntimeJobView");
    expect(jobsServiceView).not.toContain("jobServiceViewFromRuntime");
    expect(jobsServiceView).not.toContain("StoredJobView");
    expect(jobsServiceView).not.toContain("jobServiceViewFromStore");
    expect(jobsServiceView).toContain("./record-view.js");
    expect(jobsServiceTypes).toContain("isPidAlive: (pid: number) => boolean");
    expect(jobsServiceTypes).toContain(
      "signalProcess: (pid: number, signal: NodeJS.Signals) => void",
    );
    expect(jobReadRegistration).toContain("isLocalPidAlive");
    expect(jobCancelRegistration).toContain("signalLocalPid");
    expect(jobsServiceView).toContain("function jobServiceViewFromRecordView");
    expect(jobsServiceView).toContain("toJobView");
  });

  it("keeps job run projection concerns in named modules", async () => {
    const projectionView = await readSource("src/services/jobs/projections/view.ts");
    const logEvents = await readSource("src/services/jobs/projections/log-events.ts");
    const agentTraces = await readSource("src/services/jobs/projections/agent-traces.ts");
    const warnings = await readSource("src/services/jobs/projections/warnings.ts");
    const projectionTypes = await readSource("src/services/jobs/projections/types.ts");
    const viewerJobs = await readSource("src/edges/viewer/read-model/jobs.ts");

    expect(existsSync(join(ROOT, "src/jobs"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/projections/agent-traces.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/projections/warnings.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/projections/text.ts"))).toBe(true);
    expect(projectionView).not.toContain("export function deriveJobAgentTraces");
    expect(projectionView).not.toContain("export function deriveJobWarnings");
    expect(logEvents).not.toContain("node:fs/promises");
    expect(logEvents).not.toContain("readFile");
    expect(logEvents).not.toContain("readJobLogEvents(path");
    expect(logEvents).toContain("readJobLogContents");
    expect(projectionView).not.toContain("../../../stores/jobs/types.js");
    expect(projectionTypes).not.toContain("../../../stores/jobs/types.js");
    expect(warnings).not.toContain("../../../stores/jobs/types.js");
    expect(projectionTypes).toContain("../record-view.js");
    expect(agentTraces).toContain("export function deriveJobAgentTraces");
    expect(warnings).toContain("export function deriveJobWarnings");
    expect(viewerJobs).toContain("projections/agent-traces.js");
    expect(viewerJobs).toContain("projections/warnings.js");
    expect(viewerJobs).not.toContain("services/jobs/runtime/index.js");
    expect(viewerJobs).toContain("stores/jobs/index.js");
    expect(viewerJobs).toContain("services/jobs/record-view.js");
  });

  it("keeps job record persistence in an explicit store", () => {
    expect(existsSync(join(ROOT, "src/stores/jobs/records.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/types.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/record-schema.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/jobs/records.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/jobs"))).toBe(false);
  });

  it("keeps job worker process spawning out of job record startup", async () => {
    const jobStart = await readSource("src/services/jobs/runtime/start.ts");
    const jobRecordLifecycle = await readSource(
      "src/services/jobs/record-lifecycle.ts",
    );
    const workerProgram = await readSource("src/shared/worker-program.ts");
    const jobWorker = await readSource("src/edges/worker/job-worker.ts");
    const queueDrain = await readSource("src/services/jobs/runtime/queue-drain.ts");
    const backgroundStart = await readSource(
      "src/services/jobs/runtime/background-start.ts",
    );
    const backgroundProcess = await readSource("src/platform/jobs/worker-process.ts");
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const lifecycleOperations = await readSource(
      "src/services/lifecycle/operations/types.ts",
    );
    const lifecycleWorkflowProvider = await readSource(
      "src/services/lifecycle/workflows/provider.ts",
    );
    const lifecycleWorkflowTypes = await readSource(
      "src/services/lifecycle/workflow-types.ts",
    );
    const cliRuntime = await readSource("src/edges/cli/current-cli.ts");

    expect(existsSync(join(ROOT, "src/edges/worker/job-worker.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/queue-drain.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/worker.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/worker-program.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/record-factory.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/index.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/jobs/record-lifecycle.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/background-start.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/jobs/worker-process.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/app/cli-runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/background-jobs.ts"))).toBe(false);
    expect(workerProgram).toContain("export interface JobWorkerProgram");
    expect(jobStart).not.toContain("node:child_process");
    expect(jobStart).not.toContain("startJobWorkerProcess");
    expect(jobStart).not.toContain("writeJobSpec");
    expect(jobStart).not.toContain("cannot start background process");
    expect(backgroundStart).not.toContain("platform/jobs");
    expect(backgroundStart).not.toContain("startJobWorkerProcess");
    expect(backgroundStart).toContain("startWorker");
    expect(backgroundStart).toContain("writeJobSpec");
    expect(jobStart).not.toContain("function defaultSpawnBackground");
    expect(backgroundProcess).toContain("node:child_process");
    expect(backgroundProcess).toContain("export function startJobWorkerProcess");
    expect(backgroundProcess).toContain("startDetachedJobWorkerProcess");
    expect(appCliRuntime).toContain("startDetachedJobWorkerProcess");
    expect(appCliRuntime).toContain("startBackgroundJob");
    expect(appCliRuntime).toContain("createAgentRuntimeJobRunner");
    expect(backgroundProcess).not.toContain("process.env");
    expect(backgroundProcess).not.toContain("process.execPath");
    expect(jobStart).not.toContain("process.pid");
    expect(jobRecordLifecycle).not.toContain("process.pid");
    expect(queueDrain).not.toContain("process.pid");
    expect(jobRecordLifecycle).toContain("pid: number");
    expect(jobStart).toContain("pid: number");
    expect(jobWorker).toContain("pid: number");
    expect(jobWorker).toContain("drainQueuedJobs");
    expect(jobWorker).not.toContain("oldestQueuedJob");
    expect(jobWorker).not.toContain("acquireJobWorkerLock");
    expect(queueDrain).not.toContain("process.");
    expect(backgroundStart).not.toContain("process.argv");
    expect(backgroundStart).toContain("workerEnvironment");
    expect(backgroundStart).toContain("workerProgram");
    expect(backgroundStart).toContain("shared/worker-program.js");
    expect(backgroundProcess).toContain("shared/worker-program.js");
    expect(cliRuntime).toContain("shared/worker-program.js");
    expect(lifecycleOperations).toContain("shared/worker-program.js");
    expect(lifecycleOperations).not.toContain("platform/jobs/worker-process");
    expect(lifecycleWorkflowTypes).toContain("shared/worker-program.js");
    expect(lifecycleWorkflowProvider).not.toContain("platform/jobs/worker-process");
  });

  it("keeps job spec and log persistence in explicit stores", () => {
    expect(existsSync(join(ROOT, "src/stores/jobs/specs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/logs.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/index.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/jobs/log-entry.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/jobs/spec.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/jobs"))).toBe(false);
  });

  it("keeps worker lock persistence out of job queue selection", async () => {
    const queue = await readSource("src/services/jobs/runtime/queue.ts");

    expect(existsSync(join(ROOT, "src/stores/jobs/worker-lock.ts"))).toBe(true);
    expect(queue).not.toContain("worker.lock");
    expect(queue).not.toContain("mkdir");
    expect(queue).not.toContain("process.kill");
  });

  it("keeps sync runtime persistence in explicit stores", async () => {
    const syncLedger = await readSource("src/services/sync/ledger.ts");
    const syncSweep = await readSource("src/services/sync/sweep.ts");

    expect(existsSync(join(ROOT, "src/stores/sync/ledger.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/stores/sync/lock.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/sync"))).toBe(false);
    expect(syncLedger).not.toContain("sync-ledger.json");
    expect(syncLedger).not.toContain("capture-ledger.json");
    expect(syncLedger).not.toContain("mkdir");
    expect(syncSweep).not.toContain("sync.lock");
  });

  it("keeps sync transcript file mechanics in platform transcripts", async () => {
    const syncSweep = await readSource("src/services/sync/sweep.ts");
    const syncLedger = await readSource("src/services/sync/ledger.ts");
    const syncResults = await readSource("src/services/sync/sweep-results.ts");
    const transcriptCursor = await readSource("src/services/sync/transcript-cursor.ts");
    const transcriptSnapshot = await readSource("src/platform/transcripts/snapshot.ts");
    const transcriptDiscovery = await readSource("src/platform/transcripts/index.ts");
    const sharedTranscripts = await readSource("src/shared/transcripts.ts");

    expect(existsSync(join(ROOT, "src/services/sync/transcript-cursor.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/snapshot.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/types.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/transcripts.ts"))).toBe(true);
    expect(syncSweep).toContain("transcript-cursor.js");
    expect(syncSweep).toContain("shared/transcripts.js");
    expect(syncSweep).not.toContain("platform/transcripts");
    expect(syncSweep).not.toContain("from \"node:fs/promises\"");
    expect(syncSweep).not.toContain("function readTranscriptSnapshot");
    expect(syncSweep).toContain("ReadSyncTranscriptSnapshotFn");
    expect(syncSweep).not.toContain("function evaluateSyncCursor");
    expect(syncSweep).not.toContain("lastAbsorbedPrefixHash");
    expect(syncSweep).not.toContain("pendingPrefixHash");
    expect(syncLedger).not.toContain("platform/transcripts");
    expect(syncResults).not.toContain("platform/transcripts");
    expect(transcriptCursor).not.toContain("platform/transcripts");
    expect(syncLedger).toContain("transcriptCursorForSince");
    expect(transcriptCursor).not.toContain("from \"node:fs/promises\"");
    expect(transcriptCursor).not.toContain("readTranscriptSnapshot");
    expect(transcriptCursor).toContain("export function evaluateSyncCursor");
    expect(transcriptCursor).toContain("export function pendingLedgerEntry");
    expect(transcriptSnapshot).toContain("from \"node:fs/promises\"");
    expect(transcriptSnapshot).toContain("export async function readTranscriptSnapshot");
    expect(transcriptSnapshot).not.toContain("transcriptCursorForSince");
    expect(transcriptSnapshot).not.toContain("parseJsonObject");
    expect(transcriptDiscovery).toContain("shared/transcripts.js");
    expect(transcriptDiscovery).not.toContain("stores/");
    expect(sharedTranscripts).toContain("export interface TranscriptCandidate");
    expect(sharedTranscripts).toContain("export interface DiscoveredTranscript");
    expect(sharedTranscripts).toContain("export interface TranscriptSnapshot");
    expect(sharedTranscripts).toContain("transcriptCursorForSince");
  });

  it("keeps local process signaling in the platform layer", async () => {
    const jobsReadService = await readSource("src/services/jobs/read.ts");
    const jobsLogService = await readSource("src/services/jobs/log-read.ts");
    const jobsCancelService = await readSource("src/services/jobs/cancel.ts");
    const viewerJobs = await readSource("src/edges/viewer/read-model/jobs.ts");
    const jobWorkerLockStore = await readSource("src/stores/jobs/worker-lock.ts");
    const syncLockStore = await readSource("src/stores/sync/lock.ts");
    const syncSweep = await readSource("src/services/sync/sweep.ts");
    const jobWorker = await readSource("src/edges/worker/job-worker.ts");
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const cliRunner = await readSource("src/edges/cli/run.ts");
    const lifecycleRegistration = await readSource(
      "src/edges/cli/register-lifecycle-run-commands.ts",
    );
    const initRegistration = await readSource(
      "src/edges/cli/register-init-command.ts",
    );
    const absorbRegistration = await readSource(
      "src/edges/cli/register-absorb-command.ts",
    );
    const gardenRegistration = await readSource(
      "src/edges/cli/register-garden-command.ts",
    );
    const syncRegistration = await readSource(
      "src/edges/cli/register-sync-commands.ts",
    );
    const syncRuntimeInput = await readSource(
      "src/edges/cli/sync-runtime-input.ts",
    );

    expect(existsSync(join(ROOT, "src/platform/process.ts"))).toBe(true);
    for (const source of [
      jobsReadService,
      jobsLogService,
      jobsCancelService,
      viewerJobs,
      jobWorkerLockStore,
      syncLockStore,
    ]) {
      expect(source).not.toContain("process.kill");
    }
    for (const source of [jobWorkerLockStore, syncLockStore]) {
      expect(source).toContain("pid-liveness.js");
      expect(source).toContain("ownerPid");
      expect(source).toContain("isPidAlive");
      expect(source).not.toContain("platform/process");
      expect(source).not.toContain("process.pid");
    }
    expect(syncSweep).toContain("isPidAlive");
    expect(syncSweep).not.toContain("platform/process");
    expect(jobWorker).toContain("isPidAlive");
    expect(jobWorker).not.toContain("platform/process");
    expect(appCliRuntime).toContain("isLocalPidAlive");
    expect(cliRunner).toContain("isLocalPidAlive");
    expect(lifecycleRegistration).toContain("registerInitCommand");
    expect(lifecycleRegistration).not.toContain("createCliRuntime");
    for (const source of [initRegistration, absorbRegistration, gardenRegistration]) {
      expect(source).toContain("createCliRuntime");
    }
    expect(lifecycleRegistration).not.toContain("platform/process");
    expect(syncRegistration).toContain("registerSyncRunCommand(sync)");
    expect(syncRegistration).toContain("registerSyncStatusCommand(sync)");
    expect(syncRegistration).not.toContain("createCliRuntime");
    expect(syncRuntimeInput).toContain("createCliRuntime");
    expect(syncRegistration).not.toContain("platform/process");
    expect(syncRuntimeInput).not.toContain("platform/process");
  });

  it("keeps store atomic writes off process identity", async () => {
    const atomicWrite = await readSource("src/stores/atomic-write.ts");
    const storeWriters = await Promise.all([
      readSource("src/stores/jobs/records.ts"),
      readSource("src/stores/jobs/specs.ts"),
      readSource("src/stores/sync/ledger.ts"),
      readSource("src/stores/config/store.ts"),
      readSource("src/stores/config/editor.ts"),
      readSource("src/stores/update/state.ts"),
      readSource("src/stores/wiki-registry/store.ts"),
      readSource("src/stores/wiki-review/store.ts"),
      readSource("src/stores/wiki/topics/yaml.ts"),
      readSource("src/stores/wiki/topics/frontmatter-rewrite.ts"),
      readSource("src/stores/wiki/sources/maintenance.ts"),
    ]);

    expect(atomicWrite).toContain("randomUUID");
    expect(atomicWrite).toContain("writeTextFileAtomically");
    for (const source of storeWriters) {
      expect(source).toContain("writeTextFileAtomically");
      expect(source).not.toContain("process.pid");
      expect(source).not.toContain(".tmp-${process.pid}");
    }
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}
