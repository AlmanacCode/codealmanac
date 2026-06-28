import { describeWikiTopic } from "../../../../services/wiki/topics.js";
import { renderTopicsDescribe } from "./mutation-render.js";
import type { TopicsCommandOutput, TopicsDescribeOptions } from "./types.js";

/**
 * `almanac topics describe <slug> "<text>"`. Sets or updates the
 * one-liner description. An empty string clears it.
 */
export async function runTopicsDescribe(
  options: TopicsDescribeOptions,
): Promise<TopicsCommandOutput> {
  return renderTopicsDescribe(
    await describeWikiTopic({
      cwd: options.cwd,
      wiki: options.wiki,
      slug: options.slug,
      description: options.description,
    }),
  );
}
