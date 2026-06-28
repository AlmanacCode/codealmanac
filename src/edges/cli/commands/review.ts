import {
  addWikiReviewItem,
  applyWikiReviewItem,
  decideWikiReviewItem,
  getWikiReviewItem,
  listWikiReviewItems,
  reopenWikiReviewItem,
  type WikiReviewStatus,
} from "../../../services/wiki/reviews.js";
import {
  renderReviewAddResult,
  renderReviewApplyResult,
  renderReviewDecideResult,
  renderReviewListResult,
  renderReviewReopenResult,
  renderReviewShowResult,
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
  return renderReviewAddResult(
    await addWikiReviewItem({
      cwd: options.cwd,
      wiki: options.wiki,
      markdown: reviewMarkdownInput(options),
      now: options.now,
    }),
    options.json,
  );
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
  return renderReviewListResult(result, options.json);
}

export async function runReviewShow(
  options: ReviewShowOptions,
): Promise<ReviewCommandOutput> {
  return renderReviewShowResult(await getWikiReviewItem(options), options.json);
}

export async function runReviewDecide(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  return renderReviewDecideResult(
    await decideWikiReviewItem({
      cwd: options.cwd,
      wiki: options.wiki,
      id: options.id,
      markdown: reviewMarkdownInput(options),
      now: options.now,
    }),
    options.json,
  );
}

export async function runReviewApply(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  return renderReviewApplyResult(
    await applyWikiReviewItem({
      cwd: options.cwd,
      wiki: options.wiki,
      id: options.id,
      markdown: reviewMarkdownInput(options),
      now: options.now,
    }),
    options.json,
  );
}

export async function runReviewReopen(
  options: ReviewItemOptions,
): Promise<ReviewCommandOutput> {
  return renderReviewReopenResult(
    await reopenWikiReviewItem({
      cwd: options.cwd,
      wiki: options.wiki,
      id: options.id,
      markdown: reviewMarkdownInput(options),
      now: options.now,
    }),
  );
}

interface ReviewMarkdownInput {
  markdown?: string;
  stdinInput?: string;
}

function reviewMarkdownInput(options: ReviewMarkdownInput): string | undefined {
  return options.markdown ?? options.stdinInput;
}
