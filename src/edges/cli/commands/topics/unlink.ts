import { unlinkWikiTopics } from "../../../../services/wiki/topics.js";
import { renderTopicsUnlink } from "./mutation-render.js";
import type { TopicsCommandOutput, TopicsUnlinkOptions } from "./types.js";

/**
 * `almanac topics unlink <child> <parent>`. Removes a DAG edge if it
 * exists. No-op (exit 0) if not. Never deletes topics.
 */
export async function runTopicsUnlink(
  options: TopicsUnlinkOptions,
): Promise<TopicsCommandOutput> {
  return renderTopicsUnlink(
    await unlinkWikiTopics({
      cwd: options.cwd,
      wiki: options.wiki,
      child: options.child,
      parent: options.parent,
    }),
  );
}
