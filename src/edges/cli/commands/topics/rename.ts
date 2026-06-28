import { renameWikiTopic } from "../../../../services/wiki/topics.js";
import { renderTopicsRename } from "./mutation-render.js";
import type { TopicsCommandOutput, TopicsRenameOptions } from "./types.js";

/**
 * `almanac topics rename <old> <new>`. Rewrites the slug both in
 * `topics.yaml` (as an entry key and in anyone who declared it as a
 * parent) and in every affected page's frontmatter.
 *
 * Refuses if `<new>` is already a distinct topic — "merging" two topics
 * should be explicit, not a silent side effect of a rename.
 */
export async function runTopicsRename(
  options: TopicsRenameOptions,
): Promise<TopicsCommandOutput> {
  return renderTopicsRename(
    await renameWikiTopic({
      cwd: options.cwd,
      wiki: options.wiki,
      oldSlug: options.oldSlug,
      newSlug: options.newSlug,
    }),
  );
}
