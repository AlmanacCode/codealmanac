import { linkWikiTopics } from "../../../services/wiki/topics.js";
import type { TopicsCommandOutput, TopicsLinkOptions } from "./types.js";

/**
 * `almanac topics link <child> <parent>`. Adds a DAG edge after
 * checking that it wouldn't close a cycle. Both topics must exist.
 */
export async function runTopicsLink(
  options: TopicsLinkOptions,
): Promise<TopicsCommandOutput> {
  const result = await linkWikiTopics({
    cwd: options.cwd,
    wiki: options.wiki,
    child: options.child,
    parent: options.parent,
  });

  switch (result.status) {
    case "linked":
      return {
        stdout: `linked ${result.child} → ${result.parent}\n`,
        stderr: "",
        exitCode: 0,
      };
    case "already-exists":
      return {
        stdout: `edge ${result.child} → ${result.parent} already exists\n`,
        stderr: "",
        exitCode: 0,
      };
    case "empty-slug":
      return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
    case "self-parent":
      return {
        stdout: "",
        stderr: `almanac: topic cannot be its own parent\n`,
        exitCode: 1,
      };
    case "missing-topic":
      return {
        stdout: "",
        stderr: `almanac: topic "${result.slug}" does not exist\n`,
        exitCode: 1,
      };
    case "cycle":
      return {
        stdout: "",
        stderr: `almanac: adding ${result.parent} as parent of ${result.child} would create a cycle\n`,
        exitCode: 1,
      };
  }
}
