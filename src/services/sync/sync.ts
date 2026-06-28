import { readConfig } from "../../stores/config/index.js";
import {
  discoverTranscriptCandidates,
  readTranscriptSnapshot,
} from "../../platform/transcripts/index.js";
import { runPreparedAbsorbOperationWorkflow } from "../lifecycle/index.js";
import { parseDuration } from "../../shared/duration.js";
import type { TranscriptSourceApp } from "../../shared/transcripts.js";
import { executeSyncSweep } from "./sweep.js";
import type { SyncSummary } from "./sweep-results.js";
import type {
  SyncWorkflowOptions,
  SyncWorkflowReadyItem,
  SyncWorkflowResult,
  SyncWorkflowSkippedItem,
  SyncWorkflowStartedItem,
  SyncWorkflowSummary,
} from "./types.js";

const DEFAULT_QUIET = "45m";

export async function runSyncWorkflow(
  options: SyncWorkflowOptions,
): Promise<SyncWorkflowResult> {
  const sources = parseSources(options.from);
  if (!sources.ok) return { status: "invalid", error: sources.error };

  const quiet = parseQuiet(options.quiet ?? DEFAULT_QUIET);
  if (!quiet.ok) return { status: "invalid", error: quiet.error };

  return {
    status: "completed",
    summary: syncWorkflowSummaryFromSweep(
      await executeSyncSweep({
        candidates: await discoverTranscriptCandidates({
          apps: sources.value,
          home: options.homeDir,
        }),
        syncSince: await readSyncSince(options.configPath),
        quietMs: quiet.ms,
        mode: options.mode ?? "sync",
        now: options.now ?? new Date(),
        readTranscriptSnapshot,
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
    ),
  };
}

function syncWorkflowSummaryFromSweep(
  summary: SyncSummary,
): SyncWorkflowSummary {
  return {
    mode: summary.mode,
    scanned: summary.scanned,
    eligible: summary.eligible,
    syncSince: summary.syncSince,
    ready: summary.ready.map(syncWorkflowReadyItemFromSweep),
    started: summary.started.map(syncWorkflowStartedItemFromSweep),
    skipped: summary.skipped.map(syncWorkflowSkippedItemFromSweep),
    needsAttention: summary.needsAttention.map(syncWorkflowSkippedItemFromSweep),
  };
}

function syncWorkflowReadyItemFromSweep(
  item: SyncSummary["ready"][number],
): SyncWorkflowReadyItem {
  return {
    app: item.app,
    sessionId: item.sessionId,
    transcriptPath: item.transcriptPath,
    repoRoot: item.repoRoot,
    fromLine: item.fromLine,
    toLine: item.toLine,
  };
}

function syncWorkflowStartedItemFromSweep(
  item: SyncSummary["started"][number],
): SyncWorkflowStartedItem {
  return {
    app: item.app,
    sessionId: item.sessionId,
    transcriptPath: item.transcriptPath,
    repoRoot: item.repoRoot,
    fromLine: item.fromLine,
    toLine: item.toLine,
    jobId: item.jobId,
  };
}

function syncWorkflowSkippedItemFromSweep(
  item: SyncSummary["skipped"][number],
): SyncWorkflowSkippedItem {
  return {
    app: item.app,
    sessionId: item.sessionId,
    transcriptPath: item.transcriptPath,
    repoRoot: item.repoRoot,
    reason: item.reason,
  };
}

function parseSources(value: string | undefined):
  | { ok: true; value: TranscriptSourceApp[] }
  | { ok: false; error: Error } {
  if (value === undefined || value.trim().length === 0) {
    return { ok: true, value: ["claude", "codex"] };
  }

  const apps: TranscriptSourceApp[] = [];
  for (const raw of value.split(",")) {
    const app = raw.trim();
    if (app === "claude" || app === "codex") {
      if (!apps.includes(app)) apps.push(app);
      continue;
    }
    return {
      ok: false,
      error: new Error(`invalid --from "${value}" (expected claude,codex)`),
    };
  }
  return { ok: true, value: apps };
}

function parseQuiet(value: string):
  | { ok: true; ms: number }
  | { ok: false; error: Error } {
  try {
    return { ok: true, ms: parseDuration(value) * 1000 };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

async function readSyncSince(configPath: string | undefined): Promise<Date | null> {
  const config = await readConfig(configPath);
  const raw = config.automation.sync_since;
  if (raw === null) return null;

  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function syncAbsorbContext(args: {
  app: TranscriptSourceApp;
  sessionId: string;
  transcriptPath: string;
  contextNote: string;
}): string {
  return [
    "Command context:",
    "- Command: sync",
    "- Input kind: AI coding session transcript",
    `- App: ${args.app}`,
    `- Session id: ${args.sessionId}`,
    `- Transcript: ${args.transcriptPath}`,
    "",
    args.contextNote,
  ].join("\n");
}
