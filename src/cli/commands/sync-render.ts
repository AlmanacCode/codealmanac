import { renderError, renderOutcome } from "../outcome.js";
import type {
  SyncWorkflowResult,
  SyncWorkflowSummary,
} from "../../services/sync/index.js";
import type { SyncCommandResult } from "./sync.js";

export function renderSyncResult(
  result: SyncWorkflowResult,
  json: boolean | undefined,
): SyncCommandResult {
  if (result.status === "invalid") {
    return renderError(result.error, { json });
  }
  return renderSyncSummary(result.summary, json);
}

function renderSyncSummary(
  summary: SyncWorkflowSummary,
  json: boolean | undefined,
): SyncCommandResult {
  const statusMode = summary.mode === "status";
  const action = statusMode ? "ready" : "started";
  const actionCount = statusMode ? summary.ready.length : summary.started.length;
  const message = statusMode ? "sync status completed" : "sync completed";
  const lines = [
    statusMode ? "sync status:" : "sync:",
    `  scanned: ${summary.scanned}`,
    ...(summary.syncSince !== null
      ? [`  syncing transcripts after: ${summary.syncSince}`]
      : []),
    `  eligible: ${summary.eligible}`,
    `  ${action}: ${actionCount}`,
    `  skipped: ${summary.skipped.length}`,
    `  needs attention: ${summary.needsAttention.length}`,
  ];
  for (const ready of summary.ready) {
    lines.push(
      `  - ready ${ready.app} ${ready.sessionId}: ` +
        `lines ${ready.fromLine}-${ready.toLine}`,
    );
  }
  for (const started of summary.started) {
    lines.push(
      `  - started ${started.app} ${started.sessionId}: ${started.jobId} ` +
        `(lines ${started.fromLine}-${started.toLine})`,
    );
  }
  for (const item of summary.needsAttention) {
    lines.push(`  - needs attention ${item.transcriptPath}: ${item.reason}`);
  }
  return renderOutcome(
    {
      type: "success",
      message,
      data: { summary },
    },
    { json, stdout: `${lines.join("\n")}\n` },
  );
}
