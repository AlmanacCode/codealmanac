import { resolveWikiRoot } from "../indexer/resolve-wiki.js";
import {
  loadReviewFile,
  nextReviewId,
  reviewYamlPath,
  type ReviewItem,
  type ReviewStatus,
  summaryFromMarkdown,
  writeReviewFile,
} from "../review/store.js";

export interface ReviewCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ReviewOptions {
  cwd: string;
  wiki?: string;
  markdown?: string;
  stdinInput?: string;
  now?: Date;
  json?: boolean;
}

export interface ReviewItemOptions extends ReviewOptions {
  id: string;
}

export interface ReviewListOptions {
  cwd: string;
  wiki?: string;
  status?: ReviewStatus | "all";
  json?: boolean;
}

export async function runReviewAdd(
  options: ReviewOptions,
): Promise<ReviewCommandOutput> {
  const markdown = readMarkdown(options);
  if (markdown === null) return missingMarkdown("review add");

  const summary = summaryFromMarkdown(markdown);
  if (summary.length === 0) return missingMarkdown("review add");

  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const path = reviewYamlPath(repoRoot);
  const file = await loadReviewFile(path);
  const item: ReviewItem = {
    id: nextReviewId(summary, file.items),
    status: "open",
    summary,
    created_at: timestamp(options.now),
    body: markdown,
    decided_at: null,
    decision: null,
    applied_at: null,
    application: null,
  };
  file.items.push(item);
  await writeReviewFile(path, file);

  if (options.json === true) {
    return ok(`${JSON.stringify(item, null, 2)}\n`);
  }
  return ok(`added review item: ${item.id}\n`);
}

export async function runReviewList(
  options: ReviewListOptions,
): Promise<ReviewCommandOutput> {
  const status = options.status ?? "open";
  if (!isStatusFilter(status)) {
    return {
      stdout: "",
      stderr: "almanac: review list --status must be open, decided, applied, or all\n",
      exitCode: 1,
    };
  }

  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const file = await loadReviewFile(reviewYamlPath(repoRoot));
  const items = status === "all"
    ? file.items
    : file.items.filter((item) => item.status === status);

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
  options: { cwd: string; wiki?: string; id: string; json?: boolean },
): Promise<ReviewCommandOutput> {
  const found = await findReviewItem(options);
  if (found.error !== undefined) return found.error;
  const item = found.item;

  if (options.json === true) {
    return ok(`${JSON.stringify(item, null, 2)}\n`);
  }
  return ok(renderReviewItem(item));
}

export async function runReviewDecide(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  const markdown = readMarkdown(options);
  if (markdown === null) return missingMarkdown("review decide");

  const found = await findReviewItem(options);
  if (found.error !== undefined) return found.error;
  const item = found.item;
  if (item.status === "applied") {
    return {
      stdout: "",
      stderr: `almanac: review decide cannot change an applied item; reopen ${item.id} first\n`,
      exitCode: 1,
    };
  }
  item.status = "decided";
  item.decision = markdown;
  item.decided_at = timestamp(options.now);
  item.applied_at = null;
  item.application = null;
  await writeReviewFile(found.path, found.file);
  return ok(`decided review item: ${item.id}\n`);
}

export async function runReviewApply(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  const markdown = readMarkdown(options);
  if (markdown === null) return missingMarkdown("review apply");

  const found = await findReviewItem(options);
  if (found.error !== undefined) return found.error;
  const item = found.item;
  if (item.status !== "decided") {
    return {
      stdout: "",
      stderr: `almanac: review apply requires a decided item (${item.id} is ${item.status})\n`,
      exitCode: 1,
    };
  }
  item.status = "applied";
  item.application = markdown;
  item.applied_at = timestamp(options.now);
  await writeReviewFile(found.path, found.file);
  return ok(`applied review item: ${item.id}\n`);
}

export async function runReviewReopen(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  const found = await findReviewItem(options);
  if (found.error !== undefined) return found.error;
  const item = found.item;
  const markdown = readMarkdown(options);
  item.status = "open";
  item.reopened_at = timestamp(options.now);
  item.reopen_note = markdown;
  item.decided_at = null;
  item.decision = null;
  item.applied_at = null;
  item.application = null;
  await writeReviewFile(found.path, found.file);
  return ok(`reopened review item: ${item.id}\n`);
}

async function findReviewItem(options: {
  cwd: string;
  wiki?: string;
  id: string;
}): Promise<
  | { file: Awaited<ReturnType<typeof loadReviewFile>>; path: string; item: ReviewItem }
  | { error: ReviewCommandOutput }
> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const path = reviewYamlPath(repoRoot);
  const file = await loadReviewFile(path);
  const item = file.items.find((candidate) => candidate.id === options.id);
  if (item === undefined) {
    return {
      error: {
        stdout: "",
        stderr: `almanac: no review item "${options.id}"\n`,
        exitCode: 1,
      },
    };
  }
  return { file, path, item };
}

function renderReviewItem(item: ReviewItem): string {
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

function readMarkdown(options: ReviewOptions): string | null {
  const input = options.markdown ?? options.stdinInput ?? "";
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  return input.replace(/\s+$/g, "");
}

function missingMarkdown(commandName: string): ReviewCommandOutput {
  return {
    stdout: "",
    stderr: `almanac: ${commandName} requires markdown text or piped stdin\n`,
    exitCode: 1,
  };
}

function timestamp(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function ok(stdout: string): ReviewCommandOutput {
  return { stdout, stderr: "", exitCode: 0 };
}

function isStatusFilter(value: string): value is ReviewStatus | "all" {
  return value === "open" || value === "decided" || value === "applied" || value === "all";
}
