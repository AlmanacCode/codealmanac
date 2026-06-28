import { listWikiTopics } from "../../../../services/wiki/topics.js";
import { renderTopicsList } from "./read-render.js";
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
  return renderTopicsList(
    await listWikiTopics({
      cwd: options.cwd,
      wiki: options.wiki,
    }),
    {
      json: options.json,
      color: options.color,
    },
  );
}
