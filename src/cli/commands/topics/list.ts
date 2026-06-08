import { BLUE, DIM, RST } from "../../../ansi.js";
import { ensureFreshIndex } from "../../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../../wiki/indexer/resolve-wiki.js";
import { openIndex } from "../../../wiki/indexer/schema.js";
import * as query from "../../../wiki/query/index.js";
import { indexDbPath } from "../../../wiki/topics/paths.js";
import { formatTextTable } from "../table.js";
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
    const rows = query.topics.topicSummaries(db, { order: "slug" });

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

    const lines = formatTextTable({
      headers: ["TOPIC", "PAGES"],
      rows: rows.map((r) => {
        const count = `(${r.page_count} page${r.page_count === 1 ? "" : "s"})`;
        return [`${BLUE}${r.slug}${RST}`, `${DIM}${count}${RST}`];
      }),
    });
    return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
  } finally {
    db.close();
  }
}
