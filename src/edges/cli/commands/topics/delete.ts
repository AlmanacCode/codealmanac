import { deleteWikiTopic } from "../../../../services/wiki/topics.js";
import { renderTopicsDelete } from "./mutation-render.js";
import type { TopicsCommandOutput, TopicsDeleteOptions } from "./types.js";

/**
 * `almanac topics delete <slug>`. Removes the topic from `topics.yaml`
 * (if present), scrubs any parent edges pointing at it, and untags
 * every page that had it. Pages themselves are left alone — deleting a
 * topic doesn't delete pages, just the relationship.
 */
export async function runTopicsDelete(
  options: TopicsDeleteOptions,
): Promise<TopicsCommandOutput> {
  return renderTopicsDelete(
    await deleteWikiTopic({
      cwd: options.cwd,
      wiki: options.wiki,
      slug: options.slug,
    }),
  );
}
