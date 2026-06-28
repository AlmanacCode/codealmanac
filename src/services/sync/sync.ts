import { readConfig } from "../../stores/config/index.js";
import { runPreparedAbsorbOperationWorkflow } from "../lifecycle/index.js";
import { syncAbsorbContext } from "./absorb-context.js";
import { parseSyncWorkflowInput } from "./input.js";
import { completedSyncWorkflowResult } from "./summary.js";
import { executeSyncSweep } from "./sweep.js";
import { repoTranscriptCandidates } from "./transcript-candidates.js";
import type {
  SyncWorkflowOptions,
  SyncWorkflowResult,
} from "./types.js";

export async function runSyncWorkflow(
  options: SyncWorkflowOptions,
): Promise<SyncWorkflowResult> {
  const input = parseSyncWorkflowInput(options);
  if (!input.ok) return { status: "invalid", error: input.error };

  const discovered = await options.transcriptRuntime.discoverCandidates({
    apps: input.input.sources,
    homeDir: options.homeDir,
  });

  return completedSyncWorkflowResult(
    await executeSyncSweep({
      candidates: repoTranscriptCandidates(discovered),
      syncSince: await readSyncSince(options.configPath),
      quietMs: input.input.quietMs,
      mode: options.mode ?? "sync",
      now: options.now ?? new Date(),
      lockOwnerPid: options.pid,
      isPidAlive: options.isPidAlive,
      readTranscriptSnapshot: options.transcriptRuntime.readSnapshot,
      startAbsorb: async ({ candidate, contextNote }) => {
        try {
          const result = await runPreparedAbsorbOperationWorkflow({
            cwd: candidate.repoRoot,
            using: options.using,
            context: syncAbsorbContext({
              app: candidate.app,
              sessionId: candidate.sessionId,
              transcriptPath: candidate.transcriptPath,
              contextNote,
            }),
            targetKind: "session",
            targetPaths: [candidate.transcriptPath],
            startBackground: options.startBackground,
            workerProgram: options.workerProgram,
            workerEnvironment: options.workerEnvironment,
            pid: options.pid,
            isPidAlive: options.isPidAlive,
            agentRunner: options.agentRunner,
            loadPrompt: options.loadPrompt,
          });
          if (result.status === "failed") throw result.error;
          if (result.status !== "completed") {
            throw new Error(`unexpected sync absorb status: ${result.status}`);
          }
          return { ok: true, jobId: result.result.jobId };
        } catch (err: unknown) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    }),
  );
}

async function readSyncSince(configPath: string | undefined): Promise<Date | null> {
  const config = await readConfig(configPath);
  const raw = config.automation.sync_since;
  if (raw === null) return null;

  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}
