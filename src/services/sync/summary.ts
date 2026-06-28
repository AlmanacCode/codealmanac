import type { SyncSummary } from "./sweep-results.js";
import type {
  SyncWorkflowReadyItem,
  SyncWorkflowResult,
  SyncWorkflowSkippedItem,
  SyncWorkflowStartedItem,
} from "./types.js";

export function completedSyncWorkflowResult(
  summary: SyncSummary,
): SyncWorkflowResult {
  return {
    status: "completed",
    summary: {
      mode: summary.mode,
      scanned: summary.scanned,
      eligible: summary.eligible,
      syncSince: summary.syncSince,
      ready: summary.ready.map(syncWorkflowReadyItemFromSweep),
      started: summary.started.map(syncWorkflowStartedItemFromSweep),
      skipped: summary.skipped.map(syncWorkflowSkippedItemFromSweep),
      needsAttention: summary.needsAttention.map(syncWorkflowSkippedItemFromSweep),
    },
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
