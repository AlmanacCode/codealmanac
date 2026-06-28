import type Database from "better-sqlite3";

import * as query from "../../../stores/wiki/query/index.js";
import {
  getViewerJob,
  type ViewerJobPageChangeDetails,
  listViewerJobs,
  type ViewerJobDetail,
  type ViewerJobRun,
  type ViewerJobsRuntime,
} from "./jobs.js";

export type {
  ViewerJobDetail,
  ViewerJobsRuntime,
  ViewerJobRun,
};

export async function getViewerJobs(
  repoRoot: string,
  runtime: ViewerJobsRuntime,
): Promise<{ runs: ViewerJobRun[] }> {
  return listViewerJobs(repoRoot, runtime);
}

export async function getViewerJobDetail(
  repoRoot: string,
  jobId: string,
  db: Database.Database,
  runtime: ViewerJobsRuntime,
): Promise<ViewerJobDetail | null> {
  const detail = await getViewerJob(repoRoot, jobId, runtime);
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
    const page = query.pages.pageSummaryBySlug(db, slug);
    return { slug, title: page?.title ?? null };
  });
}
