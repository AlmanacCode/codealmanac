import { BLUE, DIM, RST } from "../../ansi.js";
import { ensureFreshIndex } from "../../indexer/index.js";
import { resolveWikiRoot } from "../../indexer/resolve-wiki.js";
import { openIndex } from "../../indexer/schema.js";
import { indexDbPath } from "../../topics/paths.js";
import type { TopicsCommandOutput, TopicsListOptions } from "./types.js";

/**
 * `almanac topics` (and `almanac topics list`). Prints one line per
 * known topic — from the DB, which already unions topics.yaml with any
 * ad-hoc slugs found in page frontmatter. Page counts come straight
 * from `page_topics`, which the indexer rebuilt on entry.
 */
export async function runTopicsList(
  options: TopicsListOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  await ensureFreshIndex({ repoRoot });

  const db = openIndex(indexDbPath(repoRoot));
  try {
    const rows = db
      .prepare<
        [],
        { slug: string; title: string | null; description: string | null; page_count: number }
      >(
        // page_count excludes archived pages — matches the policy used
        // by `topics show` (see `pagesDirectlyTagged`) and by every
        // page-scoped check in `health`. Pick one rule and apply it
        // everywhere; a topic with "5 pages" in `topics list` and "3
        // pages" in `topics show` is a trust-eroding inconsistency.
        `SELECT t.slug, t.title, t.description,
                (SELECT COUNT(*)
                   FROM page_topics pt
                   JOIN pages p ON p.slug = pt.page_slug
                   WHERE pt.topic_slug = t.slug AND p.archived_at IS NULL
                ) AS page_count
         FROM topics t
         ORDER BY t.slug`,
      )
      .all();

    if (options.json === true) {
      return {
        stdout: `${JSON.stringify(rows, null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    }

    if (rows.length === 0) {
      return {
        stdout:
          "no topics. create one with `almanac topics create <name>` or tag a page.\n",
        stderr: "",
        exitCode: 0,
      };
    }

    const slugWidth = rows.reduce((w, r) => Math.max(w, r.slug.length), 0);
    const lines = rows.map((r) => {
      const slug = r.slug.padEnd(slugWidth);
      const count = `(${r.page_count} page${r.page_count === 1 ? "" : "s"})`;
      return `${BLUE}${slug}${RST}  ${DIM}${count}${RST}`;
    });
    return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
  } finally {
    db.close();
  }
}
