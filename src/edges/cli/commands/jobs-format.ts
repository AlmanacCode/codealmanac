import { formatTextTable } from "./table.js";
import type { JobServiceView } from "../../../services/jobs/index.js";

export function formatJobRows(views: JobServiceView[]): string[] {
  return formatTextTable({
    headers: ["ID", "OPERATION", "STATUS", "ELAPSED"],
    rows: views.map((view) => [
      view.id,
      view.operation,
      view.displayStatus,
      formatMs(view.elapsedMs),
    ]),
  });
}

export function formatJobDetails(view: JobServiceView): string {
  return [
    `Job: ${view.id}`,
    `Operation: ${view.operation}`,
    `Status: ${view.displayStatus}`,
    `Provider: ${view.provider}${view.model !== undefined ? `/${view.model}` : ""}`,
    `Elapsed: ${formatMs(view.elapsedMs)}`,
    `Log: ${view.logPath}`,
    view.pageChanges?.summary !== undefined
      ? `Summary: ${view.pageChanges.summary}`
      : undefined,
    ...formatPageChanges(view),
    view.failure !== undefined
      ? `Reason: ${view.failure.message}`
      : view.error !== undefined
        ? `Error: ${view.error}`
        : undefined,
    view.failure?.fix !== undefined ? `Fix: ${view.failure.fix}` : undefined,
  ].filter((line): line is string => line !== undefined).join("\n") + "\n";
}

export function terminalAttachSummary(view: JobServiceView): string {
  if (view.displayStatus !== "failed" && view.displayStatus !== "stale") {
    return "";
  }
  const lines = [`job ${view.displayStatus}: ${view.id}`];
  if (view.failure !== undefined) {
    lines.push(`Reason: ${view.failure.message}`);
    if (view.failure.fix !== undefined) lines.push(`Fix: ${view.failure.fix}`);
  } else if (view.error !== undefined) {
    lines.push(`Error: ${view.error}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function formatPageChanges(view: JobServiceView): string[] {
  const changes = view.pageChanges;
  if (changes === undefined) return [];
  const total =
    changes.created.length +
    changes.updated.length +
    changes.archived.length +
    changes.deleted.length;
  if (total === 0) return ["Changes: none"];
  const lines = [
    `Changes: ${changes.created.length} created, ${changes.updated.length} updated, ${changes.archived.length} archived, ${changes.deleted.length} deleted`,
  ];
  for (const [label, slugs] of [
    ["Created", changes.created],
    ["Updated", changes.updated],
    ["Archived", changes.archived],
    ["Deleted", changes.deleted],
  ] as const) {
    if (slugs.length > 0) lines.push(`${label}: ${slugs.join(", ")}`);
  }
  return lines;
}
