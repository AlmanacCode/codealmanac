import {
  applyWikiReviewItem,
  decideWikiReviewItem,
  reopenWikiReviewItem,
} from "../../../../services/wiki/reviews.js";
import {
  reviewMarkdownInput,
  type ReviewMarkdownInput,
} from "./markdown.js";
import {
  renderReviewApplyResult,
  renderReviewDecideResult,
  renderReviewReopenResult,
  type ReviewCommandOutput,
} from "./render.js";

export interface ReviewItemOptions extends ReviewMarkdownInput {
  cwd: string;
  wiki?: string;
  id: string;
  now?: Date;
  json?: boolean;
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
