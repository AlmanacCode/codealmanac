import {
  addWikiReviewItem,
  applyWikiReviewItem,
  decideWikiReviewItem,
  getWikiReviewItem,
  listWikiReviewItems,
  reopenWikiReviewItem,
  type WikiReviewItem,
  type WikiReviewStatus,
} from "../../services/wiki/reviews.js";
import { renderOutcome } from "../outcome.js";

export interface ReviewCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ReviewAddOptions {
  cwd: string;
  wiki?: string;
  markdown?: string;
  stdinInput?: string;
  now?: Date;
  json?: boolean;
}

export interface ReviewShowOptions {
  cwd: string;
  wiki?: string;
  id: string;
  json?: boolean;
}

export interface ReviewItemOptions {
  cwd: string;
  wiki?: string;
  id: string;
  markdown?: string;
  stdinInput?: string;
  now?: Date;
  json?: boolean;
}

export interface ReviewListOptions {
  cwd: string;
  wiki?: string;
  status?: WikiReviewStatus | "all";
  json?: boolean;
}

export async function runReviewAdd(
  options: ReviewAddOptions,
): Promise<ReviewCommandOutput> {
  const result = await addWikiReviewItem({
    cwd: options.cwd,
    wiki: options.wiki,
    markdown: readMarkdown(options),
    now: options.now,
  });
  switch (result.status) {
    case "added":
      if (options.json === true) {
        return ok(`${JSON.stringify(result.item, null, 2)}\n`);
      }
      return ok(`added review item: ${result.item.id}\n`);
    case "missing-markdown":
      return missingMarkdown("review add");
  }
}

export async function runReviewList(
  options: ReviewListOptions,
): Promise<ReviewCommandOutput> {
  const status = options.status ?? "open";
  if (!isStatusFilter(status)) {
    return errorResult("review list --status must be open, decided, applied, or all", options.json);
  }

  const result = await listWikiReviewItems({
    cwd: options.cwd,
    wiki: options.wiki,
    status,
  });
  if (result.status === "invalid-status") {
    return errorResult("review list --status must be open, decided, applied, or all", options.json);
  }
  const { items } = result;

  if (options.json === true) {
    return ok(`${JSON.stringify(items, null, 2)}\n`);
  }
  if (items.length === 0) return ok("");

  return ok(
    items
      .map((item) => `${item.status.padEnd(7)} ${item.id}  ${item.summary}`)
      .join("\n") + "\n",
  );
}

export async function runReviewShow(
  options: ReviewShowOptions,
): Promise<ReviewCommandOutput> {
  const result = await getWikiReviewItem(options);
  if (result.status === "missing") {
    return errorResult(`no review item "${result.id}"`);
  }
  const item = result.item;

  if (options.json === true) {
    return ok(`${JSON.stringify(item, null, 2)}\n`);
  }
  return ok(renderReviewItem(item));
}

export async function runReviewDecide(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  const result = await decideWikiReviewItem({
    cwd: options.cwd,
    wiki: options.wiki,
    id: options.id,
    markdown: readMarkdown(options),
    now: options.now,
  });
  switch (result.status) {
    case "decided":
      return ok(`decided review item: ${result.item.id}\n`);
    case "missing-markdown":
      return missingMarkdown("review decide");
    case "missing":
      return errorResult(`no review item "${result.id}"`);
    case "already-applied":
      return errorResult(
        `review decide cannot change an applied item; reopen ${result.id} first`,
        options.json,
      );
  }
}

export async function runReviewApply(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  const result = await applyWikiReviewItem({
    cwd: options.cwd,
    wiki: options.wiki,
    id: options.id,
    markdown: readMarkdown(options),
    now: options.now,
  });
  switch (result.status) {
    case "applied":
      return ok(`applied review item: ${result.item.id}\n`);
    case "missing-markdown":
      return missingMarkdown("review apply");
    case "missing":
      return errorResult(`no review item "${result.id}"`);
    case "not-decided":
      return errorResult(
        `review apply requires a decided item (${result.id} is ${result.currentStatus})`,
        options.json,
      );
  }
}

export async function runReviewReopen(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  const result = await reopenWikiReviewItem({
    cwd: options.cwd,
    wiki: options.wiki,
    id: options.id,
    markdown: readMarkdown(options),
    now: options.now,
  });
  switch (result.status) {
    case "reopened":
      return ok(`reopened review item: ${result.item.id}\n`);
    case "missing":
      return errorResult(`no review item "${result.id}"`);
  }
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
  if (item.reopen_note !== undefined && item.reopen_note !== null && item.reopen_note.length > 0) {
    lines.push("Reopen note:", item.reopen_note.trimEnd(), "");
  }
  return lines.join("\n");
}

interface ReviewMarkdownInput {
  markdown?: string;
  stdinInput?: string;
}

function readMarkdown(options: ReviewMarkdownInput): string | undefined {
  const input = options.markdown ?? options.stdinInput ?? "";
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  return input.replace(/\s+$/g, "");
}

function missingMarkdown(commandName: string): ReviewCommandOutput {
  return errorResult(`${commandName} requires markdown text or piped stdin`);
}

function ok(stdout: string): ReviewCommandOutput {
  return { stdout, stderr: "", exitCode: 0 };
}

function errorResult(message: string, json?: boolean): ReviewCommandOutput {
  return renderOutcome({ type: "error", message }, { json });
}

function isStatusFilter(value: string): value is WikiReviewStatus | "all" {
  return value === "open" || value === "decided" || value === "applied" || value === "all";
}
