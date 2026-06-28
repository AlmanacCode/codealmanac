import {
  getWikiReviewItem,
  listWikiReviewItems,
  type WikiReviewStatus,
} from "../../../../services/wiki/reviews.js";
import {
  renderReviewListResult,
  renderReviewShowResult,
  type ReviewCommandOutput,
} from "./render.js";

export interface ReviewShowOptions {
  cwd: string;
  wiki?: string;
  id: string;
  json?: boolean;
}

export interface ReviewListOptions {
  cwd: string;
  wiki?: string;
  status?: WikiReviewStatus | "all" | string;
  json?: boolean;
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
