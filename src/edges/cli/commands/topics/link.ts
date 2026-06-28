import { linkWikiTopics } from "../../../../services/wiki/topics.js";
import { renderTopicsLink } from "./mutation-render.js";
import type { TopicsCommandOutput, TopicsLinkOptions } from "./types.js";

/**
 * `almanac topics link <child> <parent>`. Adds a DAG edge after
 * checking that it wouldn't close a cycle. Both topics must exist.
 */
export async function runTopicsLink(
  options: TopicsLinkOptions,
): Promise<TopicsCommandOutput> {
  return renderTopicsLink(
    await linkWikiTopics({
      cwd: options.cwd,
      wiki: options.wiki,
      child: options.child,
      parent: options.parent,
    }),
  );
}
