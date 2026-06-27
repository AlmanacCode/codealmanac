import {
  nextReviewId,
  summaryFromMarkdown,
  writeReviewFile,
  type ReviewItem,
} from "../../stores/wiki-review/store.js";
import {
  cleanReviewMarkdown,
  isReviewStatusFilter,
  reviewTimestamp,
} from "./review-text.js";
import type {
  AddWikiReviewItemRequest,
  AddWikiReviewItemResult,
  ApplyWikiReviewItemResult,
  ChangeWikiReviewItemRequest,
  DecideWikiReviewItemResult,
  GetWikiReviewItemResult,
  ListWikiReviewItemsRequest,
  ListWikiReviewItemsResult,
  ReopenWikiReviewItemResult,
  WikiReviewItem,
  WikiReviewItemRequest,
} from "./review-types.js";
import {
  findWikiReviewItem,
  openWikiReviewFile,
} from "./review-workspace.js";

export type {
  WikiReviewItem,
  WikiReviewStatus,
} from "./review-types.js";

export async function addWikiReviewItem(
  request: AddWikiReviewItemRequest,
): Promise<AddWikiReviewItemResult> {
  const markdown = cleanReviewMarkdown(request.markdown);
  if (markdown === null) return { status: "missing-markdown" };

  const { file, path } = await openWikiReviewFile(request);
  const summary = summaryFromMarkdown(markdown);
  if (summary.length === 0) return { status: "missing-markdown" };

  const item: ReviewItem = {
    id: nextReviewId(summary, file.items),
    status: "open",
    summary,
    created_at: reviewTimestamp(request.now),
    body: markdown,
    decided_at: null,
    decision: null,
    applied_at: null,
    application: null,
  };
  file.items.push(item);
  await writeReviewFile(path, file);
  return { status: "added", item: wikiReviewItemFromStore(item) };
}

export async function listWikiReviewItems(
  request: ListWikiReviewItemsRequest,
): Promise<ListWikiReviewItemsResult> {
  const status = request.status ?? "open";
  if (!isReviewStatusFilter(status)) return { status: "invalid-status" };

  const { file } = await openWikiReviewFile(request);
  const items = status === "all"
    ? file.items
    : file.items.filter((item) => item.status === status);
  return { status: "listed", items: items.map(wikiReviewItemFromStore) };
}

export async function getWikiReviewItem(
  request: WikiReviewItemRequest,
): Promise<GetWikiReviewItemResult> {
  const found = await findWikiReviewItem(request);
  if (found === null) return { status: "missing", id: request.id };
  return { status: "found", item: wikiReviewItemFromStore(found.item) };
}

export async function decideWikiReviewItem(
  request: ChangeWikiReviewItemRequest,
): Promise<DecideWikiReviewItemResult> {
  const markdown = cleanReviewMarkdown(request.markdown);
  if (markdown === null) return { status: "missing-markdown" };

  const found = await findWikiReviewItem(request);
  if (found === null) return { status: "missing", id: request.id };
  const item = found.item;
  if (item.status === "applied") {
    return { status: "already-applied", id: item.id };
  }

  item.status = "decided";
  item.decision = markdown;
  item.decided_at = reviewTimestamp(request.now);
  item.applied_at = null;
  item.application = null;
  await writeReviewFile(found.path, found.file);
  return { status: "decided", item: wikiReviewItemFromStore(item) };
}

export async function applyWikiReviewItem(
  request: ChangeWikiReviewItemRequest,
): Promise<ApplyWikiReviewItemResult> {
  const markdown = cleanReviewMarkdown(request.markdown);
  if (markdown === null) return { status: "missing-markdown" };

  const found = await findWikiReviewItem(request);
  if (found === null) return { status: "missing", id: request.id };
  const item = found.item;
  if (item.status !== "decided") {
    return {
      status: "not-decided",
      id: item.id,
      currentStatus: item.status,
    };
  }

  item.status = "applied";
  item.application = markdown;
  item.applied_at = reviewTimestamp(request.now);
  await writeReviewFile(found.path, found.file);
  return { status: "applied", item: wikiReviewItemFromStore(item) };
}

export async function reopenWikiReviewItem(
  request: ChangeWikiReviewItemRequest,
): Promise<ReopenWikiReviewItemResult> {
  const found = await findWikiReviewItem(request);
  if (found === null) return { status: "missing", id: request.id };

  const item = found.item;
  item.status = "open";
  item.reopened_at = reviewTimestamp(request.now);
  item.reopen_note = cleanReviewMarkdown(request.markdown);
  item.decided_at = null;
  item.decision = null;
  item.applied_at = null;
  item.application = null;
  await writeReviewFile(found.path, found.file);
  return { status: "reopened", item: wikiReviewItemFromStore(item) };
}

function wikiReviewItemFromStore(item: ReviewItem): WikiReviewItem {
  return {
    id: item.id,
    status: item.status,
    summary: item.summary,
    created_at: item.created_at,
    body: item.body,
    decided_at: item.decided_at,
    decision: item.decision,
    applied_at: item.applied_at,
    application: item.application,
    ...(item.reopened_at !== undefined ? { reopened_at: item.reopened_at } : {}),
    ...(item.reopen_note !== undefined ? { reopen_note: item.reopen_note } : {}),
  };
}
