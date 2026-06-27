import type { CommandResult } from "../helpers.js";
import { renderError, renderOutcome } from "../outcome.js";
import {
  runSyncWorkflow,
  type SyncSummary,
  type SyncWorkflowOptions,
} from "../../services/sync/index.js";

export interface SyncCommandOptions extends SyncWorkflowOptions {
  cwd: string;
  json?: boolean;
}

export async function runSyncCommand(
  options: SyncCommandOptions,
): Promise<CommandResult> {
  const result = await runSyncWorkflow(options);
  if (result.status === "invalid") {
    return renderError(result.error, { json: options.json });
  }
  return renderSyncSummary(result.summary, options.json);
}

function renderSyncSummary(
  summary: SyncSummary,
  json: boolean | undefined,
): CommandResult {
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
