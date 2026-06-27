import {
  addWikiReviewItem,
  applyWikiReviewItem,
  decideWikiReviewItem,
  getWikiReviewItem,
  listWikiReviewItems,
  reopenWikiReviewItem,
  type WikiReviewStatus,
} from "../../services/wiki/reviews.js";
import {
  renderReviewAdded,
  renderReviewAlreadyApplied,
  renderReviewApplied,
  renderReviewDecided,
  renderReviewInvalidStatus,
  renderReviewList,
  renderReviewMissingItem,
  renderReviewMissingMarkdown,
  renderReviewNotDecided,
  renderReviewReopened,
  renderReviewShow,
  type ReviewCommandOutput,
} from "./review-render.js";

export type { ReviewCommandOutput } from "./review-render.js";

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
  status?: WikiReviewStatus | "all" | string;
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
      return renderReviewAdded(result.item, options.json);
    case "missing-markdown":
      return renderReviewMissingMarkdown("review add");
  }
}

export async function runReviewList(
  options: ReviewListOptions,
): Promise<ReviewCommandOutput> {
  const status = options.status ?? "open";
  const result = await listWikiReviewItems({
    cwd: options.cwd,
    wiki: options.wiki,
    status,
  });
  if (result.status === "invalid-status") {
    return renderReviewInvalidStatus(options.json);
  }
  return renderReviewList(result.items, options.json);
}

export async function runReviewShow(
  options: ReviewShowOptions,
): Promise<ReviewCommandOutput> {
  const result = await getWikiReviewItem(options);
  if (result.status === "missing") {
    return renderReviewMissingItem(result.id);
  }
  return renderReviewShow(result.item, options.json);
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
      return renderReviewDecided(result.item);
    case "missing-markdown":
      return renderReviewMissingMarkdown("review decide");
    case "missing":
      return renderReviewMissingItem(result.id);
    case "already-applied":
      return renderReviewAlreadyApplied(result.id, options.json);
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
      return renderReviewApplied(result.item);
    case "missing-markdown":
      return renderReviewMissingMarkdown("review apply");
    case "missing":
      return renderReviewMissingItem(result.id);
    case "not-decided":
      return renderReviewNotDecided(
        result.id,
        result.currentStatus,
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
      return renderReviewReopened(result.item);
    case "missing":
      return renderReviewMissingItem(result.id);
  }
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
