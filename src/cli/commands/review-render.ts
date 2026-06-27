import type {
  WikiReviewItem,
  WikiReviewStatus,
} from "../../services/wiki/review-types.js";
import { renderOutcome } from "../outcome.js";

export interface ReviewCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderReviewAdded(
  item: WikiReviewItem,
  json?: boolean,
): ReviewCommandOutput {
  if (json === true) return ok(`${JSON.stringify(item, null, 2)}\n`);
  return ok(`added review item: ${item.id}\n`);
}

export function renderReviewList(
  items: WikiReviewItem[],
  json?: boolean,
): ReviewCommandOutput {
  if (json === true) return ok(`${JSON.stringify(items, null, 2)}\n`);
  if (items.length === 0) return ok("");

  return ok(
    items
      .map((item) => `${item.status.padEnd(7)} ${item.id}  ${item.summary}`)
      .join("\n") + "\n",
  );
}

export function renderReviewShow(
  item: WikiReviewItem,
  json?: boolean,
): ReviewCommandOutput {
  if (json === true) return ok(`${JSON.stringify(item, null, 2)}\n`);
  return ok(renderReviewItem(item));
}

export function renderReviewDecided(item: WikiReviewItem): ReviewCommandOutput {
  return ok(`decided review item: ${item.id}\n`);
}

export function renderReviewApplied(item: WikiReviewItem): ReviewCommandOutput {
  return ok(`applied review item: ${item.id}\n`);
}

export function renderReviewReopened(item: WikiReviewItem): ReviewCommandOutput {
  return ok(`reopened review item: ${item.id}\n`);
}

export function renderReviewMissingMarkdown(
  commandName: string,
): ReviewCommandOutput {
  return renderReviewError(
    `${commandName} requires markdown text or piped stdin`,
  );
}

export function renderReviewInvalidStatus(json?: boolean): ReviewCommandOutput {
  return renderReviewError(
    "review list --status must be open, decided, applied, or all",
    json,
  );
}

export function renderReviewMissingItem(
  id: string,
  json?: boolean,
): ReviewCommandOutput {
  return renderReviewError(`no review item "${id}"`, json);
}

export function renderReviewAlreadyApplied(
  id: string,
  json?: boolean,
): ReviewCommandOutput {
  return renderReviewError(
    `review decide cannot change an applied item; reopen ${id} first`,
    json,
  );
}

export function renderReviewNotDecided(
  id: string,
  currentStatus: WikiReviewStatus,
  json?: boolean,
): ReviewCommandOutput {
  return renderReviewError(
    `review apply requires a decided item (${id} is ${currentStatus})`,
    json,
  );
}

function renderReviewItem(item: WikiReviewItem): string {
  const lines = [
    `id: ${item.id}`,
    `status: ${item.status}`,
    `summary: ${item.summary}`,
    `created: ${item.created_at}`,
  ];
  if (item.decided_at !== null) lines.push(`decided: ${item.decided_at}`);
  if (item.applied_at !== null) lines.push(`applied: ${item.applied_at}`);
  if (item.reopened_at !== undefined && item.reopened_at !== null) {
    lines.push(`reopened: ${item.reopened_at}`);
  }
  lines.push("", item.body.trimEnd(), "");
  if (item.decision !== null) {
    lines.push("Decision:", item.decision.trimEnd(), "");
  }
  if (item.application !== null) {
    lines.push("Application:", item.application.trimEnd(), "");
  }
  if (
    item.reopen_note !== undefined &&
    item.reopen_note !== null &&
    item.reopen_note.length > 0
  ) {
    lines.push("Reopen note:", item.reopen_note.trimEnd(), "");
  }
  return lines.join("\n");
}

function ok(stdout: string): ReviewCommandOutput {
  return { stdout, stderr: "", exitCode: 0 };
}

function renderReviewError(
  message: string,
  json?: boolean,
): ReviewCommandOutput {
  return renderOutcome({ type: "error", message }, { json });
}
