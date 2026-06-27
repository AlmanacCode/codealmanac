import { unlinkWikiTopics } from "../../../services/wiki/topics.js";
import type { TopicsCommandOutput, TopicsUnlinkOptions } from "./types.js";

/**
 * `almanac topics unlink <child> <parent>`. Removes a DAG edge if it
 * exists. No-op (exit 0) if not. Never deletes topics.
 */
export async function runTopicsUnlink(
  options: TopicsUnlinkOptions,
): Promise<TopicsCommandOutput> {
  const result = await unlinkWikiTopics({
    cwd: options.cwd,
    wiki: options.wiki,
    child: options.child,
    parent: options.parent,
  });

  if (result.status === "empty-slug") {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }

  if (result.status === "no-edge") {
    return {
      stdout: `no edge ${result.child} → ${result.parent}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout: `unlinked ${result.child} → ${result.parent}\n`,
    stderr: "",
    exitCode: 0,
  };
}
