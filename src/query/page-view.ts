import { readFile } from "node:fs/promises";

import type Database from "better-sqlite3";

export interface PageView {
  slug: string;
  title: string | null;
  summary: string | null;
  file_path: string;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  supersedes: string[];
  topics: string[];
  file_refs: Array<{ path: string; is_dir: boolean }>;
  wikilinks_out: string[];
  wikilinks_in: string[];
  cross_wiki_links: Array<{ wiki: string; target: string }>;
  body: string;
}

export async function getPageView(
  db: Database.Database,
  slug: string,
): Promise<PageView | null> {
  const pageRow = db
    .prepare<
      [string],
      {
        slug: string;
        title: string | null;
        summary: string | null;
        file_path: string;
        updated_at: number;
        archived_at: number | null;
        superseded_by: string | null;
      }
    >(
      "SELECT slug, title, summary, file_path, updated_at, archived_at, superseded_by FROM pages WHERE slug = ?",
    )
    .get(slug);
  if (pageRow === undefined) return null;

  const topics = db
    .prepare<[string], { topic_slug: string }>(
      "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
    )
    .all(slug)
    .map((r) => r.topic_slug);

  const refs = db
    .prepare<[string], { original_path: string; is_dir: number }>(
      "SELECT original_path, is_dir FROM file_refs WHERE page_slug = ? ORDER BY original_path",
    )
    .all(slug)
    .map((r) => ({ path: r.original_path, is_dir: r.is_dir === 1 }));

  const linksOut = db
    .prepare<[string], { target_slug: string }>(
      "SELECT target_slug FROM wikilinks WHERE source_slug = ? ORDER BY target_slug",
    )
    .all(slug)
    .map((r) => r.target_slug);

  const linksIn = db
    .prepare<[string], { source_slug: string }>(
      "SELECT source_slug FROM wikilinks WHERE target_slug = ? ORDER BY source_slug",
    )
    .all(slug)
    .map((r) => r.source_slug);

  const xwiki = db
    .prepare<[string], { target_wiki: string; target_slug: string }>(
      "SELECT target_wiki, target_slug FROM cross_wiki_links WHERE source_slug = ? ORDER BY target_wiki, target_slug",
    )
    .all(slug)
    .map((r) => ({ wiki: r.target_wiki, target: r.target_slug }));

  const supersedesRows = db
    .prepare<[string], { slug: string }>(
      "SELECT slug FROM pages WHERE superseded_by = ? ORDER BY slug",
    )
    .all(slug)
    .map((r) => r.slug);

  let body = "";
  try {
    body = stripFrontmatter(await readFile(pageRow.file_path, "utf8"));
  } catch {
    // Keep the indexed metadata useful even if the markdown file is
    // temporarily unreadable during a branch switch or editor save.
  }

  return {
    slug: pageRow.slug,
    title: pageRow.title,
    summary: pageRow.summary,
    file_path: pageRow.file_path,
    updated_at: pageRow.updated_at,
    archived_at: pageRow.archived_at,
    superseded_by: pageRow.superseded_by,
    supersedes: supersedesRows,
    topics,
    file_refs: refs,
    wikilinks_out: linksOut,
    wikilinks_in: linksIn,
    cross_wiki_links: xwiki,
    body,
  };
}

/**
 * Strip a leading YAML frontmatter block (fenced by `---` on its own
 * lines). Everything between the opening fence and the next fence is
 * dropped, along with the surrounding fence.
 */
export function stripFrontmatter(src: string): string {
  if (!src.startsWith("---\n") && !src.startsWith("---\r\n")) return src;
  const afterOpen = src.replace(/^---\r?\n/, "");
  const endMatch = afterOpen.match(/^---[ \t]*\r?\n/m);
  if (endMatch === null || endMatch.index === undefined) return src;
  return afterOpen.slice(endMatch.index + endMatch[0].length);
}
