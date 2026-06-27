import { toKebabCase } from "../../slug.js";
import { ensureFreshIndex } from "../../wiki/indexer/index.js";
import { openIndex } from "../../wiki/indexer/schema.js";
import * as query from "../../wiki/query/index.js";
import { indexDbPath } from "../../wiki/topics/paths.js";
import type {
  ResolvedPageTopicPage,
  TagWikiPagesRequest,
} from "./page-topic-types.js";

export type ParsedPageTopicInput =
  | { status: "pages"; pages: string[] }
  | { status: "stdin-input-missing" }
  | { status: "page-required" };

export interface ResolvedPageTopicPages {
  resolved: ResolvedPageTopicPage[];
  missing: string[];
}

export function parsePageTopicInput(
  request: TagWikiPagesRequest,
): ParsedPageTopicInput {
  if (request.stdin === true) {
    if (request.stdinInput === undefined) {
      return { status: "stdin-input-missing" };
    }
    const pages = request.stdinInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return pages.length > 0 ? { status: "pages", pages } : { status: "page-required" };
  }

  return request.page !== undefined && request.page.length > 0
    ? { status: "pages", pages: [request.page] }
    : { status: "page-required" };
}

export async function resolvePageTopicPages(
  repoRoot: string,
  pages: string[],
): Promise<ResolvedPageTopicPages> {
  await ensureFreshIndex({ repoRoot });
  const db = openIndex(indexDbPath(repoRoot));
  const resolved: ResolvedPageTopicPage[] = [];
  const missing: string[] = [];
  try {
    for (const page of pages) {
      const filePath = query.pages.pageFilePathBySlug(db, toKebabCase(page));
      if (filePath === null) {
        missing.push(page);
      } else {
        resolved.push({ page, filePath });
      }
    }
  } finally {
    db.close();
  }
  return { resolved, missing };
}

export async function resolveSinglePageTopicPage(
  repoRoot: string,
  page: string,
): Promise<string | null> {
  await ensureFreshIndex({ repoRoot });
  const db = openIndex(indexDbPath(repoRoot));
  try {
    return query.pages.pageFilePathBySlug(db, page);
  } finally {
    db.close();
  }
}
