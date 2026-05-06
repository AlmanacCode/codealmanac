import { ensureFreshIndex } from "../../indexer/index.js";
import { resolveWikiRoot } from "../../indexer/resolve-wiki.js";
import { openIndex } from "../../indexer/schema.js";
import { toKebabCase } from "../../slug.js";
import { indexDbPath } from "../../topics/paths.js";
import {
  formatShow,
  pagesDirectlyTagged,
  pagesForSubtree,
  type TopicsShowRecord,
} from "./read.js";
import type { TopicsCommandOutput, TopicsShowOptions } from "./types.js";

/**
 * `almanac topics show <slug>`. Prints metadata + parents, children,
 * and the page list. `--descendants` widens the page list to include
 * pages tagged with any descendant topic (via the DAG).
 */
export async function runTopicsShow(
  options: TopicsShowOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  await ensureFreshIndex({ repoRoot });

  const slug = toKebabCase(options.slug);
  if (slug.length === 0) {
    return {
      stdout: "",
      stderr: `almanac: empty topic slug\n`,
      exitCode: 1,
    };
  }

  const db = openIndex(indexDbPath(repoRoot));
  try {
    const row = db
      .prepare<
        [string],
        { slug: string; title: string | null; description: string | null }
      >("SELECT slug, title, description FROM topics WHERE slug = ?")
      .get(slug);
    if (row === undefined) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${slug}"\n`,
        exitCode: 1,
      };
    }

    const parents = db
      .prepare<[string], { parent_slug: string }>(
        "SELECT parent_slug FROM topic_parents WHERE child_slug = ? ORDER BY parent_slug",
      )
      .all(slug)
      .map((r) => r.parent_slug);

    const children = db
      .prepare<[string], { child_slug: string }>(
        "SELECT child_slug FROM topic_parents WHERE parent_slug = ? ORDER BY child_slug",
      )
      .all(slug)
      .map((r) => r.child_slug);

    const pageSlugs = options.descendants === true
      ? pagesForSubtree(db, slug)
      : pagesDirectlyTagged(db, slug);

    const record: TopicsShowRecord = {
      slug: row.slug,
      title: row.title,
      description: row.description,
      parents,
      children,
      pages: pageSlugs,
      descendants_used: options.descendants === true,
    };

    if (options.json === true) {
      return {
        stdout: `${JSON.stringify(record, null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    return { stdout: formatShow(record), stderr: "", exitCode: 0 };
  } finally {
    db.close();
  }
}
