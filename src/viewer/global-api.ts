import { existsSync } from "node:fs";
import { join } from "node:path";

import { readRegistry, type RegistryEntry } from "../registry/index.js";
import { createViewerApi, type ViewerApi } from "./api.js";

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

export function createGlobalViewerApi(): GlobalViewerApi {
  return {
    async wikis() {
      const entries = await readRegistry();
      const wikis: ViewerWikiSummary[] = [];
      for (const entry of entries) {
        if (!isBrowseableWiki(entry)) continue;
        const overview = await createViewerApi({ repoRoot: entry.path }).overview();
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
      const entry = (await readRegistry()).find((candidate) => candidate.name === name);
      if (entry === undefined) {
        throw new UnknownWikiError(name);
      }
      if (!isBrowseableWiki(entry)) {
        throw new UnreachableWikiError(name, entry.path);
      }
      return createViewerApi({ repoRoot: entry.path });
    },
  };
}

function isBrowseableWiki(entry: RegistryEntry): boolean {
  return entry.path.length > 0 && existsSync(join(entry.path, ".almanac"));
}
