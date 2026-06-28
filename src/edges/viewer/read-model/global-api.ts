import {
  getBrowseableWiki,
  listBrowseableWikis,
} from "../../../services/wiki/registry.js";
import { createViewerApi, type ViewerApi } from "./api.js";
import type { ViewerJobsRuntime } from "./jobs-api.js";

export type GlobalViewerApiContext = ViewerJobsRuntime;

export interface ViewerWikiSummary {
  name: string;
  description: string;
  path: string;
  registered_at: string;
  pageCount: number;
  topicCount: number;
  recentPages: number;
}

export interface GlobalViewerApi {
  wikis(): Promise<{ wikis: ViewerWikiSummary[] }>;
  forWiki(name: string): Promise<ViewerApi>;
}

export class UnknownWikiError extends Error {
  constructor(name: string) {
    super(`no registered wiki named "${name}"`);
    this.name = "UnknownWikiError";
  }
}

export class UnreachableWikiError extends Error {
  constructor(name: string, path: string) {
    super(`wiki "${name}" path is unreachable (${path})`);
    this.name = "UnreachableWikiError";
  }
}

export function createGlobalViewerApi(ctx: GlobalViewerApiContext): GlobalViewerApi {
  return {
    async wikis() {
      const entries = await listBrowseableWikis();
      const wikis: ViewerWikiSummary[] = [];
      for (const entry of entries) {
        const overview = await createViewerApi({
          repoRoot: entry.path,
          runtime: ctx,
        }).overview();
        wikis.push({
          name: entry.name,
          description: entry.description,
          path: entry.path,
          registered_at: entry.registered_at,
          pageCount: overview.pageCount,
          topicCount: overview.topicCount,
          recentPages: overview.recentPages.length,
        });
      }
      return { wikis };
    },

    async forWiki(name) {
      const result = await getBrowseableWiki(name);
      if (result.status === "missing") {
        throw new UnknownWikiError(name);
      }
      if (result.status === "unreachable") {
        const entry = result.wiki;
        throw new UnreachableWikiError(name, entry.path);
      }
      const entry = result.wiki;
      return createViewerApi({ repoRoot: entry.path, runtime: ctx });
    },
  };
}
