import {
  loadReviewFile,
  reviewYamlPath,
  type ReviewItem,
  type ReviewStatus,
} from "../../../stores/wiki-review/store.js";

export interface ViewerReview {
  items: ReviewItem[];
  counts: Record<ReviewStatus, number>;
}

export async function getViewerReview(repoRoot: string): Promise<ViewerReview> {
  const file = await loadReviewFile(reviewYamlPath(repoRoot));
  return {
    items: file.items,
    counts: {
      open: file.items.filter((item) => item.status === "open").length,
      decided: file.items.filter((item) => item.status === "decided").length,
      applied: file.items.filter((item) => item.status === "applied").length,
    },
  };
}
