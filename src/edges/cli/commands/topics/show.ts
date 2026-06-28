import { readWikiTopic } from "../../../../services/wiki/topics.js";
import { renderTopicsShow } from "./read-render.js";
import type { TopicsCommandOutput, TopicsShowOptions } from "./types.js";

/**
 * `almanac topics show <slug>`. Prints metadata + parents, children,
 * and the page list. `--descendants` widens the page list to include
 * pages tagged with any descendant topic (via the DAG).
 */
export async function runTopicsShow(
  options: TopicsShowOptions,
): Promise<TopicsCommandOutput> {
  return renderTopicsShow(
    await readWikiTopic({
      cwd: options.cwd,
      wiki: options.wiki,
      slug: options.slug,
      descendants: options.descendants,
    }),
    {
      json: options.json,
      color: options.color,
    },
  );
}
