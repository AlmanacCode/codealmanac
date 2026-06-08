import type Database from "better-sqlite3";

import { pageSummaryBySlug } from "../wiki/query/pages.js";
import {
  getViewerJob,
  type ViewerJobPageChangeDetails,
  listViewerJobs,
  type ViewerJobDetail,
  type ViewerJobRun,
} from "./jobs.js";

export type {
  ViewerJobDetail,
  ViewerJobRun,
};

export async function getViewerJobs(
  repoRoot: string,
): Promise<{ runs: ViewerJobRun[] }> {
  return listViewerJobs(repoRoot);
}

export async function getViewerJobDetail(
  repoRoot: string,
  runId: string,
  db: Database.Database,
): Promise<ViewerJobDetail | null> {
  const detail = await getViewerJob(repoRoot, runId);
  if (detail === null) return null;
  return {
    ...detail,
    run: {
      ...detail.run,
      pageChangeDetails: pageChangeDetails(db, detail.run.pageChanges),
    },
  };
}

function pageChangeDetails(
  db: Database.Database,
  changes: ViewerJobRun["pageChanges"],
): ViewerJobPageChangeDetails | undefined {
  if (changes === undefined) return undefined;
  return {
    created: pageChangeRefs(db, changes.created),
    updated: pageChangeRefs(db, changes.updated),
    archived: pageChangeRefs(db, changes.archived),
    deleted: changes.deleted.map((slug) => ({ slug, title: null })),
  };
}

function pageChangeRefs(
  db: Database.Database,
  slugs: string[],
): Array<{ slug: string; title: string | null }> {
  return slugs.map((slug) => {
    const page = pageSummaryBySlug(db, slug);
    return { slug, title: page?.title ?? null };
  });
}
