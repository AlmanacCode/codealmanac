import { ensureFreshIndex } from "../../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../../wiki/indexer/resolve-wiki.js";
import { openIndex } from "../../../wiki/indexer/schema.js";
import { toKebabCase } from "../../../slug.js";
import { indexDbPath } from "../../../wiki/topics/paths.js";
import { topicDetail } from "../../../wiki/query/topics.js";
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
    const detail = topicDetail(db, slug);
    if (detail === null) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${slug}"\n`,
        exitCode: 1,
      };
    }

    const pageSlugs = options.descendants === true
      ? pagesForSubtree(db, slug)
      : pagesDirectlyTagged(db, slug);

    const record: TopicsShowRecord = {
      slug: detail.slug,
      title: detail.title,
      description: detail.description,
      parents: detail.parents.map((parent) => parent.slug),
      children: detail.children.map((child) => child.slug),
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
