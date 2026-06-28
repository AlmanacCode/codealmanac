import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries: lifecycle and providers", () => {
  it("keeps sync command adapters out of transcript and absorb workflow mechanics", async () => {
    const syncServiceIndex = await readSource("src/services/sync/index.ts");
    const syncService = await readSource("src/services/sync/sync.ts");
    const syncServiceTypes = await readSource("src/services/sync/types.ts");
    const syncSweep = await readSource("src/services/sync/sweep.ts");
    const syncSweepResults = await readSource("src/services/sync/sweep-results.ts");
    const syncCandidateEligibility = await readSource(
      "src/services/sync/candidate-eligibility.ts",
    );
    const syncInternalSessions = await readSource(
      "src/services/sync/internal-sessions.ts",
    );
    const syncAbsorbEnqueue = await readSource(
      "src/services/sync/absorb-enqueue.ts",
    );
    const syncInput = await readSource("src/services/sync/input.ts");
    const syncSummary = await readSource("src/services/sync/summary.ts");
    const syncCandidates = await readSource(
      "src/services/sync/transcript-candidates.ts",
    );
    const syncAbsorbContext = await readSource(
      "src/services/sync/absorb-context.ts",
    );
    const jobsProviderSessions = await readSource(
      "src/services/jobs/provider-sessions.ts",
    );
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const transcriptDiscovery = await readSource("src/platform/transcripts/index.ts");
    const transcriptRuntime = await readSource("src/platform/transcripts/runtime.ts");
    const sharedTranscripts = await readSource("src/shared/transcripts.ts");
    const syncRunCommand = await readSource(
      "src/edges/cli/commands/sync/run.ts",
    );
    const syncStatusCommand = await readSource(
      "src/edges/cli/commands/sync/status.ts",
    );
    const syncOptions = await readSource(
      "src/edges/cli/commands/sync/options.ts",
    );
    const syncRegistration = await readSource(
      "src/edges/cli/register-sync-commands.ts",
    );
    const syncRuntimeInput = await readSource(
      "src/edges/cli/sync-runtime-input.ts",
    );
    const syncRunRegistration = await readSource(
      "src/edges/cli/register-sync-run-command.ts",
    );
    const syncStatusRegistration = await readSource(
      "src/edges/cli/register-sync-status-command.ts",
    );

    expect(existsSync(join(ROOT, "src/services/sync/types.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/sync/sweep-results.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/sync/candidate-eligibility.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/sync/internal-sessions.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/sync/absorb-enqueue.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/index.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/transcripts/runtime.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/sync"))).toBe(false);
    expect(syncServiceIndex).not.toContain("../../sync");
    expect(syncService).not.toContain("interface SyncWorkflowOptions");
    expect(syncService).not.toContain("interface SyncWorkflowSummary");
    expect(syncService).not.toContain("homedir");
    expect(syncServiceTypes).toContain("interface SyncWorkflowOptions");
    expect(syncServiceTypes).toContain("homeDir: string");
    expect(syncServiceTypes).not.toContain("homeDir?: string");
    expect(syncServiceTypes).toContain("interface SyncWorkflowSummary");
    expect(syncServiceTypes).toContain("shared/transcripts.js");
    expect(syncService).not.toContain("export type SyncWorkflowSummary = sync.SyncSummary");
    expect(syncService).not.toContain(
      "SyncWorkflowStartedItem extends SyncWorkflowReadyItem",
    );
    expect(syncService).not.toContain("...syncWorkflowReadyItemFromSweep(item)");
    expect(syncService).toContain("completedSyncWorkflowResult");
    expect(syncService).not.toContain("syncWorkflowReadyItemFromSweep");
    expect(syncService).not.toContain("function parseSources");
    expect(syncService).not.toContain("function parseQuiet");
    expect(syncService).not.toContain("function syncAbsorbContext");
    expect(syncService).not.toContain("platform/transcripts");
    expect(syncService).toContain("repoTranscriptCandidates");
    expect(syncService).not.toContain("findNearestAlmanacDir");
    expect(syncInput).toContain("parseSyncWorkflowInput");
    expect(syncInput).toContain("parseDuration");
    expect(syncSummary).toContain("completedSyncWorkflowResult");
    expect(syncSummary).toContain("syncWorkflowReadyItemFromSweep");
    expect(syncCandidates).toContain("repoTranscriptCandidates");
    expect(syncCandidates).toContain("findNearestAlmanacDir");
    expect(syncAbsorbContext).toContain("syncAbsorbContext");
    expect(syncServiceTypes).not.toContain("interface SyncTranscriptRuntime");
    expect(syncSweep).not.toContain("platform/transcripts");
    expect(syncSweep).not.toContain("stores/jobs");
    expect(syncSweep).not.toContain("listJobProviderSessionIds");
    expect(syncSweep).toContain("syncCandidateEligibility");
    expect(syncSweep).toContain("isInternalAlmanacSession");
    expect(syncSweep).toContain("enqueueSyncAbsorb");
    expect(syncCandidateEligibility).toContain("syncCandidateEligibility");
    expect(syncCandidateEligibility).toContain("quiet-window");
    expect(syncInternalSessions).toContain("listJobProviderSessionIds");
    expect(syncAbsorbEnqueue).toContain("enqueueSyncAbsorb");
    expect(syncAbsorbEnqueue).toContain("syncCursorContext");
    expect(syncSweepResults).not.toContain("platform/transcripts");
    expect(syncSweepResults).not.toContain("syncCursorContext");
    expect(jobsProviderSessions).toContain("listJobRecords");
    for (const syncCommand of [syncRunCommand, syncStatusCommand, syncOptions]) {
      expect(syncCommand).not.toContain("platform/transcripts");
    }
    expect(syncRegistration).not.toContain("platform/transcripts");
    expect(syncRegistration).toContain("registerSyncRunCommand(sync)");
    expect(syncRegistration).toContain("registerSyncStatusCommand(sync)");
    expect(syncRegistration).not.toContain("createCliRuntime");
    expect(syncRuntimeInput).not.toContain("platform/transcripts");
    expect(syncRuntimeInput).toContain("createCliRuntime");
    expect(syncRunRegistration).toContain("syncRuntimeInput()");
    expect(syncRunRegistration).toContain("using: opts.using");
    expect(syncStatusRegistration).toContain("syncStatusRuntimeInput()");
    expect(syncStatusRegistration).toContain("runSyncStatusCommand");
    expect(syncStatusRegistration).not.toContain("startBackground");
    expect(appCliRuntime).toContain("createPlatformSyncTranscriptRuntime");
    expect(appCliRuntime).toContain("shared/transcripts.js");
    expect(transcriptRuntime).toContain("discoverTranscriptCandidates");
    expect(transcriptRuntime).toContain("readTranscriptSnapshot");
    expect(transcriptRuntime).toContain("SyncTranscriptRuntime");
    expect(transcriptRuntime).toContain("shared/transcripts.js");
    expect(transcriptRuntime).not.toContain("services/sync");
    expect(transcriptDiscovery).toContain("discoverTranscriptCandidates");
    expect(transcriptDiscovery).toContain("shared/transcripts.js");
    expect(transcriptDiscovery).not.toContain("stores/");
    expect(transcriptDiscovery).not.toContain("operations");
    expect(transcriptDiscovery).not.toContain("stores/sync");
    expect(transcriptDiscovery).not.toContain("services/sync");
    expect(sharedTranscripts).toContain("TranscriptSourceApp");
    expect(sharedTranscripts).toContain("interface SyncTranscriptRuntime");
    expect(syncRunCommand).toContain("services/sync/index.js");
    expect(syncStatusCommand).toContain("services/sync/index.js");
    expect(syncOptions).toContain("services/sync/index.js");
    for (const syncCommand of [syncRunCommand, syncStatusCommand, syncOptions]) {
      expect(syncCommand).not.toContain("../../sync");
      expect(syncCommand).not.toContain("../../operations");
      expect(syncCommand).not.toContain("readConfig");
      expect(syncCommand).not.toContain("parseDuration");
      expect(syncCommand).not.toContain("homedir");
      expect(syncCommand).not.toContain("discoverTranscriptCandidates");
      expect(syncCommand).not.toContain("sync completed");
      expect(syncCommand).not.toContain("providerForRepo");
      expect(syncCommand).not.toContain("syncAbsorbContext");
    }
    expect(syncSweep).not.toContain("interface SyncSummary");
    expect(syncSweep).not.toContain("function cursorContext");
    expect(syncSweep).not.toContain("syncCursorContext");
    expect(syncSweepResults).toContain("interface SyncSummary");
    expect(syncSweepResults).toContain("syncSkippedSummary");
  });

  it("keeps lifecycle operation command adapters out of run-start mechanics", async () => {
    const lifecycleServiceIndex = await readSource("src/services/lifecycle/index.ts");
    const initWorkflow = await readSource(
      "src/services/lifecycle/workflows/init-workflow.ts",
    );
    const absorbWorkflow = await readSource(
      "src/services/lifecycle/workflows/absorb-workflow.ts",
    );
    const gardenWorkflow = await readSource(
      "src/services/lifecycle/workflows/garden-workflow.ts",
    );
    const workflowProvider = await readSource(
      "src/services/lifecycle/workflows/provider.ts",
    );
    const lifecycleResults = await readSource(
      "src/services/lifecycle/operation-results.ts",
    );
    const lifecycleWorkflowTypes = await readSource(
      "src/services/lifecycle/workflow-types.ts",
    );
    const lifecycleOperationRun = await readSource(
      "src/services/lifecycle/operations/run.ts",
    );
    const lifecycleOperationTypes = await readSource(
      "src/services/lifecycle/operations/types.ts",
    );
    const platformPrompts = await readSource("src/platform/prompts.ts");
    const sharedOperationPrompts = await readSource(
      "src/shared/operation-prompts.ts",
    );
    const sharedAbsorbSources = await readSource("src/shared/absorb-sources.ts");
    const lifecycleAbsorbIndex = await readSource("src/services/lifecycle/absorb/index.ts");
    const lifecycleAbsorbInput = await readSource("src/services/lifecycle/absorb/input.ts");
    const platformGithubSource = await readSource("src/platform/github/source.ts");
    const platformAbsorbSourceResolver = await readSource("src/platform/sources/absorb.ts");
    const appCliRuntime = await readSource("src/app/cli-runtime.ts");
    const lifecycleCliEdge = await readSource(
      "src/edges/cli/register-lifecycle-run-commands.ts",
    );
    const absorbCliEdge = await readSource(
      "src/edges/cli/register-absorb-command.ts",
    );
    const syncService = await readSource("src/services/sync/sync.ts");
    const initCommand = await readSource(
      "src/edges/cli/commands/operations/init.ts",
    );
    const absorbCommand = await readSource(
      "src/edges/cli/commands/operations/absorb.ts",
    );
    const gardenCommand = await readSource(
      "src/edges/cli/commands/operations/garden.ts",
    );
    const operationsRender = await readSource(
      "src/edges/cli/commands/operations/render.ts",
    );

    expect(existsSync(join(ROOT, "src/services/lifecycle/operation-results.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflows.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflows/init-workflow.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflows/absorb-workflow.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflows/garden-workflow.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflows/provider.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/workflow-types.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/operations"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/absorb"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/prompts.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/prompts.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/operation-prompts.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/absorb-sources.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/absorb/input-source.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/services/lifecycle/absorb/source-ref.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/platform/github/source.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/platform/sources/absorb.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/operations"))).toBe(false);
    expect(existsSync(join(ROOT, "src/absorb"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations-render.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/init.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/absorb.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/garden.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/operations/render.ts")))
      .toBe(true);
    expect(lifecycleServiceIndex).not.toContain("../../operations");
    expect(lifecycleServiceIndex).toContain("./workflows/init-workflow.js");
    expect(lifecycleServiceIndex).toContain("./workflows/absorb-workflow.js");
    expect(lifecycleServiceIndex).toContain("./workflows/garden-workflow.js");
    expect(lifecycleServiceIndex).toContain("./workflows/provider.js");
    for (const workflow of [
      initWorkflow,
      absorbWorkflow,
      gardenWorkflow,
      workflowProvider,
    ]) {
      expect(workflow).not.toContain(
        "LifecycleOperationRunResult = operations.OperationRunResult",
      );
      expect(workflow).not.toContain("interface LifecycleOperationDeps");
      expect(workflow).not.toContain(
        "InitOperationWorkflowOptions extends LifecycleOperationDeps",
      );
      expect(workflow).not.toContain(
        "AbsorbOperationWorkflowOptions extends LifecycleOperationDeps",
      );
      expect(workflow).not.toContain(
        "GardenOperationWorkflowOptions extends LifecycleOperationDeps",
      );
      expect(workflow).not.toContain(
        "LifecycleOperationForegroundStarter = operations.StartForegroundJob",
      );
      expect(workflow).not.toContain(
        "LifecycleOperationBackgroundStarter = operations.StartBackgroundJob",
      );
      expect(workflow).not.toContain(
        "LifecycleAbsorbSourceResolver = absorb.ResolveSourceFn",
      );
      expect(workflow).not.toContain("interface LifecycleForegroundStartRequest");
      expect(workflow).not.toContain("interface InitOperationWorkflowOptions");
    }
    expect(lifecycleWorkflowTypes).toContain("interface LifecycleForegroundStartRequest");
    expect(lifecycleWorkflowTypes).toContain("interface InitOperationWorkflowOptions");
    expect(lifecycleWorkflowTypes).not.toContain("stores/jobs/types");
    expect(lifecycleWorkflowTypes).not.toContain("JobRecord");
    expect(lifecycleOperationTypes).toContain("OperationStartedJobRecord");
    expect(lifecycleOperationTypes).not.toContain("jobs/runtime/executor");
    expect(lifecycleOperationTypes).not.toContain("jobs/runtime/background-start");
    expect(lifecycleOperationTypes).not.toContain("StartJobResult");
    expect(lifecycleOperationTypes).not.toContain("StartBackgroundJobResult");
    expect(lifecycleOperationTypes).not.toContain("stores/jobs/types");
    expect(initWorkflow).not.toContain(
      "function lifecycleOperationRunResultFromOperation",
    );
    expect(initWorkflow).toContain("initOperationContext");
    expect(initWorkflow).toContain("Command context:");
    expect(absorbWorkflow).toContain("runPreparedAbsorbOperationWorkflow");
    expect(absorbWorkflow).not.toContain("runGardenOperationWorkflow");
    expect(gardenWorkflow).toContain("runGardenOperationWorkflow");
    expect(gardenWorkflow).not.toContain("runAbsorbOperationWorkflow");
    expect(workflowProvider).toContain("resolveWorkflowProvider");
    expect(workflowProvider).toContain("parseLifecycleProviderSelection");
    expect(lifecycleWorkflowTypes).toContain("LifecyclePromptLoader");
    expect(lifecycleOperationRun).toContain("joinPromptSections");
    expect(lifecycleOperationRun).toContain("loadPrompt: OperationPromptLoader");
    expect(lifecycleOperationRun).not.toContain("agent/prompts");
    expect(lifecycleOperationRun).not.toContain("platform/prompts");
    expect(platformPrompts).toContain("loadBundledPrompt");
    expect(platformPrompts).toContain("resolvePromptsDir");
    expect(sharedOperationPrompts).toContain("OPERATION_PROMPT_NAMES");
    expect(sharedOperationPrompts).toContain("OperationPromptLoader");
    expect(sharedAbsorbSources).toContain("parseSourceRef");
    expect(sharedAbsorbSources).toContain("ResolveSourceFn");
    expect(sharedAbsorbSources).toContain("AbsorbInputSource");
    expect(lifecycleResults).toContain("lifecycleOperationRunResultFromOperation");
    expect(lifecycleResults).toContain("interface LifecycleOperationFailure");
    expect(lifecycleAbsorbIndex).not.toContain("platform/github");
    expect(lifecycleAbsorbInput).not.toContain("platform/github");
    expect(lifecycleAbsorbInput).not.toContain("resolveGitHubSource");
    expect(platformAbsorbSourceResolver).toContain("resolveGitHubSource");
    expect(platformAbsorbSourceResolver).toContain("ResolveSourceFn");
    expect(platformAbsorbSourceResolver).toContain("shared/absorb-sources");
    expect(platformAbsorbSourceResolver).not.toContain("services/lifecycle/absorb");
    expect(platformGithubSource).toContain("shared/absorb-sources");
    expect(lifecycleCliEdge).toContain("registerAbsorbCommand");
    expect(lifecycleCliEdge).not.toContain("createCliRuntime");
    expect(absorbCliEdge).toContain("createCliRuntime");
    expect(absorbCliEdge).toContain("resolveSource: runtime.resolveAbsorbSource");
    expect(absorbCliEdge).toContain("loadPrompt: runtime.loadPrompt");
    expect(lifecycleCliEdge).not.toContain("platform/sources");
    expect(lifecycleCliEdge).not.toContain("platform/prompts");
    expect(appCliRuntime).toContain("createPlatformAbsorbSourceResolver");
    expect(appCliRuntime).toContain("loadBundledPrompt");
    expect(platformGithubSource).not.toContain("services/lifecycle");
    expect(syncService).toContain("runPreparedAbsorbOperationWorkflow");
    expect(syncService).not.toContain("services/lifecycle/operations");
    expect(initCommand).toContain("services/lifecycle/index.js");
    expect(absorbCommand).toContain("services/lifecycle/index.js");
    expect(gardenCommand).toContain("services/lifecycle/index.js");
    expect(operationsRender).not.toContain("../../agent");
    expect(operationsRender).not.toContain("AgentRuntimeFailure");
    for (const command of [initCommand, absorbCommand, gardenCommand]) {
      expect(command).not.toContain("import type { CommandResult }");
      expect(command).not.toContain("extends InitOperationWorkflowOptions");
      expect(command).not.toContain("extends AbsorbOperationWorkflowOptions");
      expect(command).not.toContain("extends GardenOperationWorkflowOptions");
      expect(command).not.toContain('["onEvent"]');
      expect(command).not.toContain('["startForeground"]');
      expect(command).not.toContain('["startBackground"]');
      expect(command).not.toContain('["resolveSource"]');
      expect(command).not.toContain("../../services/lifecycle/operations/index");
      expect(command).not.toContain("../../absorb");
      expect(command).not.toContain("resolveProvider");
      expect(command).not.toContain("operations.build");
      expect(command).not.toContain("operations.garden");
      expect(command).not.toContain("absorb.startRun");
      expect(command).not.toContain("initContext");
      expect(command).not.toContain("formatInitRequestContext");
      expect(command).not.toContain("Command context:");
      expect(command).not.toContain("Force requested");
    }
    expect(initCommand).toContain("toInitOperationWorkflowOptions");
    expect(absorbCommand).toContain("toAbsorbOperationWorkflowOptions");
    expect(gardenCommand).toContain("toGardenOperationWorkflowOptions");
  });

  it("keeps Claude provider protocol mechanics in provider-local modules", async () => {
    const claudeProvider = await readSource("src/agent/runtime/providers/claude.ts");
    const claudeOptions = await readSource(
      "src/agent/runtime/providers/claude/options.ts",
    );
    const claudeRun = await readSource("src/agent/runtime/providers/claude/run.ts");
    const claudeResult = await readSource(
      "src/agent/runtime/providers/claude/result.ts",
    );
    const claudeStatus = await readSource(
      "src/agent/runtime/providers/claude/status.ts",
    );
    const claudeProcess = await readSource(
      "src/agent/runtime/providers/claude/process.ts",
    );

    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/run.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/result.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/status.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/options.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/events.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/failures.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/process.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/claude/usage.ts"))).toBe(true);
    expect(claudeProvider).not.toContain("spawnManagedChildProcess");
    expect(claudeProvider).not.toContain("process.once");
    expect(claudeProvider).not.toContain("process.off");
    expect(claudeProvider).not.toContain("function installAbortSignalHandlers");
    expect(claudeProvider).not.toContain("installClaudeAbortSignalHandlers");
    expect(claudeProvider).not.toContain("for await");
    expect(claudeProvider).not.toContain("ANTHROPIC_API_KEY");
    expect(claudeProvider).not.toContain("function buildClaudeOptions");
    expect(claudeProvider).not.toContain("function toClaudeAgentRuntimeEvents");
    expect(claudeProvider).not.toContain("function classifyClaudeFailure");
    expect(claudeProvider).not.toContain("function mapClaudeUsage");
    expect(claudeProvider).toContain("runClaudeAgentRuntime");
    expect(claudeProvider).toContain("checkClaudeProviderStatus");
    expect(claudeRun).toContain("installClaudeAbortSignalHandlers");
    expect(claudeRun).toContain("toClaudeAgentRuntimeEvents");
    expect(claudeRun).toContain("classifyClaudeFailure");
    expect(claudeRun).not.toContain("mapClaudeUsage");
    expect(claudeRun).toContain("claudeResultUpdate");
    expect(claudeResult).toContain("mapClaudeUsage");
    expect(claudeResult).toContain("finalJsonSchemaOutput");
    expect(claudeStatus).toContain("ANTHROPIC_API_KEY");
    expect(claudeStatus).toContain("checkClaudeProviderStatus");
    expect(claudeOptions).not.toContain("spawnManagedChildProcess");
    expect(claudeOptions).not.toContain("managed.attachAbort");
    expect(claudeOptions).not.toContain("process.env");
    expect(claudeOptions).toContain("environment: NodeJS.ProcessEnv");
    expect(claudeOptions).toContain("spawnClaudeCodeProcessGroup");
    expect(claudeProcess).toContain("spawnManagedChildProcess");
    expect(claudeProcess).toContain("managed.attachAbort");
    expect(claudeProcess).toContain("process.once");
  });

  it("keeps agent runtime provider runtime environment explicit", async () => {
    const registry = await readSource("src/agent/runtime/providers/index.ts");
    const runtimeIndex = await readSource("src/agent/runtime/index.ts");
    const runtimeTypes = await readSource("src/agent/runtime/types.ts");
    const sharedProviderCatalog = await readSource("src/shared/agent-provider.ts");
    const sharedRuntimeEvents = await readSource(
      "src/shared/agent-runtime/events.ts",
    );
    const sharedRuntimeFinalOutput = await readSource(
      "src/shared/agent-runtime/final-output.ts",
    );
    const sharedRuntimeTools = await readSource(
      "src/shared/agent-runtime/tools.ts",
    );
    const runtimeJobRunner = await readSource("src/agent/runtime/job-runner.ts");
    const claudeProvider = await readSource("src/agent/runtime/providers/claude.ts");
    const codexProvider = await readSource("src/agent/runtime/providers/codex.ts");
    const runtimeRunner = await readSource("src/shared/agent-runtime/runner.ts");
    const jobExecutor = await readSource("src/services/jobs/runtime/executor.ts");
    const jobStart = await readSource("src/services/jobs/runtime/start.ts");
    const jobWorker = await readSource("src/edges/worker/job-worker.ts");
    const queueDrain = await readSource("src/services/jobs/runtime/queue-drain.ts");
    const jobStoreTypes = await readSource("src/stores/jobs/types.ts");
    const jobStoreSpecs = await readSource("src/stores/jobs/specs.ts");
    const sharedOperationSpec = await readSource("src/shared/operation-spec.ts");
    const sharedOperationOutput = await readSource(
      "src/shared/operation-output.ts",
    );
    const lifecycleOperationOutput = await readSource(
      "src/services/lifecycle/operations/output.ts",
    );
    const jobsServiceTypes = await readSource("src/services/jobs/types.ts");

    expect(existsSync(join(ROOT, "src/agent/provider-id.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/agent/runtime/events.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/agent/runtime/final-output.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/agent/runtime/tools.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/shared/agent-provider.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/agent-runtime/events.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/shared/agent-runtime/final-output.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/shared/agent-runtime/tools.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/shared/operation-spec.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/shared/operation-output.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/services/lifecycle/operations/spec.ts")))
      .toBe(false);
    expect(sharedProviderCatalog).toContain("ALL_AGENT_PROVIDER_IDS");
    expect(sharedProviderCatalog).toContain("PROVIDER_DEFINITIONS");
    expect(sharedRuntimeEvents).toContain("AgentRuntimeEvent");
    expect(sharedRuntimeEvents).toContain("AgentRuntimeRunHooks");
    expect(sharedRuntimeFinalOutput).toContain("FinalOutputSpec");
    expect(sharedRuntimeTools).toContain("ToolRequest");

    expect(registry).toContain("createAgentRuntimeProviderRegistry");
    expect(registry).toContain("environment: NodeJS.ProcessEnv");
    expect(registry).not.toContain("process.env");
    expect(runtimeIndex).toContain("createAgentRuntimeProviderRegistry");
    expect(runtimeIndex).toContain("../../shared/agent-runtime/events.js");
    expect(runtimeTypes).toContain("../../shared/agent-runtime/events.js");
    expect(runtimeTypes).toContain("../../shared/agent-runtime/runner.js");
    expect(runtimeIndex).not.toContain("getAgentRuntimeProvider");
    expect(runtimeIndex).not.toContain("listAgentRuntimeProviders");
    expect(runtimeJobRunner).toContain("createAgentRuntimeJobRunner");
    expect(runtimeJobRunner).toContain("createAgentRuntimeProviderRegistry");
    expect(runtimeJobRunner).toContain("environment: NodeJS.ProcessEnv");
    expect(runtimeJobRunner).not.toContain("services/jobs");
    expect(existsSync(join(ROOT, "src/services/jobs/runtime/agent-runner.ts")))
      .toBe(false);
    expect(runtimeRunner).toContain("export type AgentRuntimeRunner");
    expect(runtimeRunner).toContain("OperationSpec");
    expect(runtimeRunner).not.toContain("agent/runtime/types");
    expect(jobStoreTypes).toContain("../../shared/agent-runtime/events.js");
    expect(jobStoreTypes).not.toContain("../../agent/runtime");
    expect(jobStoreTypes).toContain("../../shared/operation-spec.js");
    expect(jobStoreTypes).not.toContain("../../services/lifecycle");
    expect(jobStoreSpecs).toContain("../../shared/operation-spec.js");
    expect(jobStoreSpecs).not.toContain("../../services/lifecycle");
    expect(sharedOperationSpec).toContain("./agent-runtime/final-output.js");
    expect(sharedOperationSpec).not.toContain("../agent/runtime");
    expect(sharedOperationOutput).toContain("interface OperationOutput");
    expect(sharedOperationOutput).toContain("./agent-runtime/final-output.js");
    expect(lifecycleOperationOutput).toContain("shared/operation-output.js");
    expect(lifecycleOperationOutput).not.toContain("stores/jobs/types");
    expect(jobStoreTypes).toContain("../../shared/operation-output.js");
    expect(jobStoreTypes).not.toContain("interface JobOperationOutput");
    expect(jobsServiceTypes).toContain("OperationOutput");
    expect(jobsServiceTypes).not.toContain("JobServiceJsonValue");
    expect(claudeProvider).not.toContain("process.env");
    expect(codexProvider).not.toContain("process.env");
    expect(claudeProvider).not.toContain("claudeAgentRuntimeProvider");
    expect(codexProvider).not.toContain("codexAgentRuntimeProvider");
    expect(jobExecutor).not.toContain("createAgentRuntimeProviderRegistry");
    expect(jobExecutor).not.toContain("workerEnvironment");
    expect(jobExecutor).not.toContain("harnessRun");
    expect(jobExecutor).toContain("agentRunner");
    expect(jobStart).not.toContain("workerEnvironment");
    expect(jobStart).not.toContain("harnessRun");
    expect(jobStart).toContain("agentRunner");
    expect(queueDrain).not.toContain("workerEnvironment");
    expect(queueDrain).not.toContain("harnessRun");
    expect(queueDrain).toContain("agentRunner");
    expect(jobWorker).toContain("createAgentRuntimeJobRunner");
    expect(jobWorker).toContain("workerEnvironment: NodeJS.ProcessEnv");
    expect(jobWorker).toContain("agentRunner?: AgentRuntimeRunner");
  });

  it("keeps job runtime page snapshots behind wiki file stores", async () => {
    const wikiEffects = await readSource("src/services/jobs/runtime/wiki-effects.ts");
    const pageSnapshots = await readSource(
      "src/stores/wiki-files/page-snapshots.ts",
    );

    expect(existsSync(join(ROOT, "src/services/jobs/runtime/snapshots.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/stores/wiki-files/page-snapshots.ts"))).toBe(
      true,
    );
    expect(wikiEffects).toContain("snapshotWikiPages");
    expect(wikiEffects).toContain("diffPageSnapshots");
    expect(wikiEffects).not.toContain("node:fs");
    expect(wikiEffects).not.toContain("\"node:path\"");
    expect(wikiEffects).not.toContain(".almanac");
    expect(wikiEffects).not.toContain("readFile");
    expect(wikiEffects).not.toContain("readdir");
    expect(pageSnapshots).toContain("node:fs");
    expect(pageSnapshots).toContain("readFile");
    expect(pageSnapshots).toContain("parseFrontmatter");
  });

  it("passes agent readiness runtime facts through an explicit context", async () => {
    const agentTypes = await readSource("src/agent/types.ts");
    const sharedReadiness = await readSource("src/shared/agent-readiness.ts");
    const appReadinessRuntime = await readSource(
      "src/app/agent-readiness-runtime.ts",
    );
    const configProviders = await readSource(
      "src/shared/agent-provider-enablement.ts",
    );
    const providerSetupView = await readSource(
      "src/services/agents/provider-setup-view.ts",
    );
    const providerModelChoices = await readSource(
      "src/services/agents/provider-model-choices.ts",
    );
    const providerSelection = await readSource(
      "src/services/agents/provider-selection.ts",
    );
    const readinessStatus = await readSource(
      "src/agent/readiness/providers/status.ts",
    );
    const claudeReadiness = await readSource(
      "src/agent/readiness/providers/claude/index.ts",
    );
    const codexReadiness = await readSource(
      "src/agent/readiness/providers/codex-cli.ts",
    );
    const cursorReadiness = await readSource(
      "src/agent/readiness/providers/cursor-cli.ts",
    );
    const claudeAuth = await readSource("src/agent/providers/claude/auth.ts");
    const claudeAuthCli = await readSource(
      "src/agent/providers/claude/auth-cli.ts",
    );
    const claudeAuthStatus = await readSource(
      "src/agent/providers/claude/auth-status.ts",
    );
    const platformAgentCliStatus = await readSource(
      "src/platform/agent-cli-status.ts",
    );
    const codexRuntimeStatus = await readSource(
      "src/agent/runtime/providers/codex/status.ts",
    );

    expect(existsSync(join(ROOT, "src/agent/auth"))).toBe(false);
    expect(existsSync(join(ROOT, "src/agent/providers/claude/auth.ts"))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, "src/agent/providers/claude/auth-cli.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/agent/providers/claude/auth-status.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/agent/readiness/providers/cli-status.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/platform/agent-cli-status.ts"))).toBe(
      true,
    );
    expect(agentTypes).toContain("export interface AgentProviderRuntime");
    expect(agentTypes).toContain("environment: NodeJS.ProcessEnv");
    expect(agentTypes).toContain("checkStatus(runtime: AgentProviderRuntime)");
    expect(sharedReadiness).toContain("export interface AgentReadinessRuntime");
    expect(appReadinessRuntime).toContain("agent/readiness/providers/index.js");
    expect(appReadinessRuntime).toContain("createAgentReadinessRuntime");
    expect(existsSync(join(ROOT, "src/agent/readiness/view.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/services/agents/provider-view.ts"))).toBe(
      false,
    );
    expect(existsSync(join(ROOT, "src/services/agents/provider-setup-view.ts"))).toBe(
      true,
    );
    expect(configProviders).not.toContain("process.env");
    expect(configProviders).toContain("isCursorEnabled(env: NodeJS.ProcessEnv)");
    expect(configProviders).toContain("getEnabledAgentProviderIds(\n  env: NodeJS.ProcessEnv");
    expect(readinessStatus).toContain("providerRuntime(args)");
    expect(readinessStatus).toContain("shared/agent-provider-enablement");
    expect(providerSetupView).not.toContain("agent/readiness/providers");
    expect(providerSetupView).not.toContain("../../agent/types");
    expect(providerSetupView).toContain("readinessRuntime");
    expect(providerSetupView).not.toContain("process.env");
    expect(providerSetupView).toContain("buildProviderSetupView");
    expect(providerModelChoices).toContain("buildProviderModelChoices");
    expect(providerModelChoices).not.toContain("buildProviderSetupView");
    expect(providerSelection).toContain("parseAgentSelection");
    expect(providerSelection).not.toContain("buildProviderSetupView");
    expect(claudeReadiness).toContain("providers/claude/auth.js");
    expect(claudeReadiness).not.toContain("process.env");
    expect(claudeAuth).not.toContain("process.env");
    expect(claudeAuth).not.toContain("node:child_process");
    expect(claudeAuth).not.toContain("createRequire");
    expect(claudeAuth).not.toContain("JSON.parse");
    expect(claudeAuth).toContain("auth-cli.js");
    expect(claudeAuth).toContain("auth-status.js");
    expect(claudeAuthCli).toContain("node:child_process");
    expect(claudeAuthCli).toContain("createRequire");
    expect(claudeAuthCli).toContain("parseClaudeAuthStatus");
    expect(claudeAuthStatus).toContain("parseClaudeAuthStatus");
    expect(claudeAuthStatus).toContain("JSON.parse");
    expect(claudeReadiness).toContain("runtime.environment.ANTHROPIC_API_KEY");
    expect(claudeAuth).toContain("environment.ANTHROPIC_API_KEY");
    expect(codexReadiness).toContain("platform/agent-cli-status.js");
    expect(cursorReadiness).toContain("platform/agent-cli-status.js");
    expect(codexRuntimeStatus).toContain("platform/agent-cli-status.js");
    for (const providerStatusSource of [
      codexReadiness,
      cursorReadiness,
      codexRuntimeStatus,
    ]) {
      expect(providerStatusSource).not.toContain("node:child_process");
      expect(providerStatusSource).not.toContain("spawn(");
      expect(providerStatusSource).not.toContain("spawnSync");
    }
    expect(platformAgentCliStatus).toContain("node:child_process");
    expect(platformAgentCliStatus).toContain("spawn(");
    expect(platformAgentCliStatus).toContain("spawnSync");
    expect(platformAgentCliStatus).toContain("runInjectedStatusCommand");
    expect(platformAgentCliStatus).toContain("runStatusCommand");
  });

  it("keeps Codex app-server policy out of the JSON-RPC run loop", async () => {
    const appServer = await readSource("src/agent/runtime/providers/codex/app-server.ts");
    const request = await readSource("src/agent/runtime/providers/codex/request.ts");
    const appServerRpc = await readSource(
      "src/agent/runtime/providers/codex/app-server-rpc.ts",
    );
    const appServerProcess = await readSource(
      "src/agent/runtime/providers/codex/app-server-process.ts",
    );
    const appServerSession = await readSource(
      "src/agent/runtime/providers/codex/app-server-session.ts",
    );
    const appServerRootTurn = await readSource(
      "src/agent/runtime/providers/codex/app-server-root-turn.ts",
    );
    const appNotifications = await readSource(
      "src/agent/runtime/providers/codex/app-notifications.ts",
    );
    const appAgentMessages = await readSource(
      "src/agent/runtime/providers/codex/app-agent-messages.ts",
    );
    const appTerminalEvents = await readSource(
      "src/agent/runtime/providers/codex/app-terminal-events.ts",
    );

    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-config.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/server-requests.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-session.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-rpc.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-process.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-server-root-turn.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-agent-messages.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/agent/runtime/providers/codex/app-terminal-events.ts"))).toBe(true);
    expect(appServer).not.toContain("CODEALMANAC_CODEX_APP_SERVER");
    expect(appServer).not.toContain("function parsePositiveEnvInt");
    expect(appServer).not.toContain("interface PendingRequest");
    expect(appServer).not.toContain("pending.set");
    expect(appServer).not.toContain("function handleResponse");
    expect(appServer).not.toContain("Almanac does not handle Codex app-server request");
    expect(appServer).not.toContain("case \"item/commandExecution/requestApproval\"");
    expect(appServer).not.toContain("case \"account/chatgptAuthTokens/refresh\"");
    expect(appServer).not.toContain("codexClientVersion");
    expect(appServer).not.toContain("combineCodexPrompt");
    expect(appServer).not.toContain("codexAppServerSandboxPolicy");
    expect(appServer).not.toContain("requestRpc(\"initialize\"");
    expect(appServer).not.toContain("requestRpc(\"thread/start\"");
    expect(appServer).not.toContain("requestRpc(\"turn/start\"");
    expect(appServer).not.toContain("spawnManagedChildProcess");
    expect(appServer).not.toContain("child.stdout");
    expect(appServer).not.toContain("NodeJS.ErrnoException");
    expect(appServer).not.toContain("process.once");
    expect(appServer).toContain("startCodexAppServerProcess");
    expect(appServer).not.toContain("function isRootTurnCompletion");
    expect(appServer).not.toContain("function isRootThreadNotification");
    expect(appServerProcess).toContain("spawnManagedChildProcess");
    expect(appServerProcess).toContain("child.stdout");
    expect(appServerProcess).toContain("JSON.parse");
    expect(appServerProcess).toContain("installCodexAppServerSignalHandlers");
    expect(appServerSession).toContain("startCodexAppServerTurn");
    expect(appServerSession).toContain("requestRpc(\"initialize\"");
    expect(appServerSession).toContain("requestRpc(\"thread/start\"");
    expect(appServerSession).toContain("requestRpc(\"turn/start\"");
    expect(appServerRpc).toContain("interface PendingRequest");
    expect(appServerRpc).toContain("pending.set");
    expect(appServerRpc).toContain("function handleResponse");
    expect(appServerRootTurn).toContain("isCodexRootTurnCompletion");
    expect(appServerRootTurn).toContain("isCodexRootThreadNotification");
    expect(appNotifications).not.toContain("parseJsonSchemaFinalOutputText");
    expect(appNotifications).not.toContain("markAgentCompleted");
    expect(appNotifications).not.toContain("classifyCodexFailure");
    expect(appNotifications).not.toContain("Codex warning");
    expect(appNotifications).not.toContain("state.success = true");
    expect(appNotifications).toContain("mapCodexAgentMessageCompletion");
    expect(appNotifications).toContain("mapCodexTurnCompleted");
    expect(appAgentMessages).toContain("parseJsonSchemaFinalOutputText");
    expect(appAgentMessages).toContain("markAgentCompleted");
    expect(appTerminalEvents).toContain("classifyCodexFailure");
    expect(appTerminalEvents).toContain("mapCodexWarningNotification");
    expect(appTerminalEvents).toContain("state.success = true");
    expect(request).not.toContain("process.env");
    expect(request).toContain("environment: NodeJS.ProcessEnv");
  });

  it("keeps migrate legacy-sources adapter out of source migration mechanics", async () => {
    const migrateLegacySourcesCommand = await readSource(
      "src/edges/cli/commands/migrate/legacy-sources.ts",
    );
    const migrateAutomationCommand = await readSource(
      "src/edges/cli/commands/migrate/automation.ts",
    );
    const migrateRender = await readSource("src/edges/cli/commands/migrate/render.ts");
    const sourceMigrationService = await readSource(
      "src/services/wiki/source-migration.ts",
    );
    const wikiSources = await readSource("src/stores/wiki/sources/index.ts");
    const wikiSourcesFrontmatterFix = await readSource(
      "src/stores/wiki/sources/frontmatter-fix.ts",
    );
    const wikiSourcesMaintenance = await readSource(
      "src/stores/wiki/sources/maintenance.ts",
    );

    expect(existsSync(join(ROOT, "src/stores/wiki/sources/frontmatter-fix.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/migrate.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/migrate-render.ts")))
      .toBe(false);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/migrate/legacy-sources.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/migrate/automation.ts")))
      .toBe(true);
    expect(existsSync(join(ROOT, "src/edges/cli/commands/migrate/render.ts")))
      .toBe(true);
    expect(migrateLegacySourcesCommand).toContain("services/wiki/source-migration.js");
    expect(migrateLegacySourcesCommand).not.toContain("services/automation/index.js");
    expect(migrateAutomationCommand).toContain("services/automation/index.js");
    expect(migrateAutomationCommand).not.toContain("services/wiki/source-migration.js");
    for (const migrateCommand of [
      migrateLegacySourcesCommand,
      migrateAutomationCommand,
    ]) {
      expect(migrateCommand).toContain("./render.js");
      expect(migrateCommand).not.toContain("stores/wiki/indexer");
      expect(migrateCommand).not.toContain("stores/wiki/sources");
      expect(migrateCommand).not.toContain("platform/automation");
      expect(migrateCommand).not.toContain("resolveWikiRoot");
      expect(migrateCommand).not.toContain("migrateLegacySourceFrontmatter");
      expect(migrateCommand).not.toContain("detectLegacyCaptureSweepAutomation");
      expect(migrateCommand).not.toContain("removeLaunchdJob");
      expect(migrateCommand).not.toContain("runAutomationInstall");
      expect(migrateCommand).not.toContain("JSON.stringify");
      expect(migrateCommand).not.toContain("renderOutcome");
      expect(migrateCommand).not.toContain("migrated automation to sync");
      expect(migrateCommand).not.toContain("no migratable legacy source");
    }
    expect(migrateRender).toContain("renderMigrateLegacySources");
    expect(migrateRender).toContain("renderMigrateAutomation");
    expect(migrateRender).toContain("renderAutomationInstallFailure");
    expect(sourceMigrationService).not.toContain(
      "export type MigrateLegacySourcesResult = LegacySourceMigrationResult",
    );
    expect(wikiSources).not.toContain("MigrateLegacySources");
    expect(wikiSourcesMaintenance).not.toContain("MigrateLegacySources");
    expect(wikiSourcesMaintenance).not.toContain("yaml.load");
    expect(wikiSourcesMaintenance).not.toContain("function splitFrontmatter");
    expect(wikiSourcesMaintenance).not.toContain("function idFromPath");
    expect(wikiSourcesFrontmatterFix).toContain("applySourceFrontmatterFix");
    expect(wikiSourcesFrontmatterFix).toContain("function splitFrontmatter");
  });

  it("keeps automation command options owned by the command adapter", async () => {
    const automationInstallCommand = await readSource(
      "src/edges/cli/commands/automation/install.ts",
    );
    const automationUninstallCommand = await readSource(
      "src/edges/cli/commands/automation/uninstall.ts",
    );
    const automationStatusCommand = await readSource(
      "src/edges/cli/commands/automation/status.ts",
    );

    expect(existsSync(join(ROOT, "src/edges/cli/commands/automation.ts"))).toBe(false);
    expect(automationInstallCommand).toContain("AutomationInstallCommandOptions");
    expect(automationInstallCommand).toContain("cwd: string");
    expect(automationInstallCommand).toContain("homeDir: string");
    expect(automationInstallCommand).toContain("pathEnvironment: string | undefined");
    expect(automationInstallCommand).toContain("toAutomationInstallOptions");
    expect(automationUninstallCommand).toContain("AutomationUninstallCommandOptions");
    expect(automationUninstallCommand).toContain("toAutomationUninstallOptions");
    expect(automationStatusCommand).toContain("AutomationStatusCommandOptions");
    expect(automationStatusCommand).toContain("toAutomationStatusOptions");
    for (const automationCommand of [
      automationInstallCommand,
      automationUninstallCommand,
      automationStatusCommand,
    ]) {
      expect(automationCommand).not.toContain(
      "AutomationOptions = AutomationInstallOptions & AutomationUninstallOptions",
      );
      expect(automationCommand).not.toContain("export type { AutomationStatusOptions }");
    }
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}
