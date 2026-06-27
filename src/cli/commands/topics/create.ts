import { createWikiTopic } from "../../../services/wiki/topics.js";
import type { TopicsCommandOutput, TopicsCreateOptions } from "./types.js";

/**
 * `almanac topics create <name> [--parent <slug>]...`.
 *
 * Policy: `--parent <slug>` MUST refer to an existing topic (created
 * earlier in topics.yaml or indexed from page frontmatter). Auto-
 * creating parents silently would let typos cascade — `create JWT
 * --parent secuirty` would quietly spawn a "secuirty" topic. Better to
 * refuse and point the user at `almanac topics create <parent>` first.
 *
 * Already-exists is not an error if no new parents are being added —
 * rerunning the same `create` is a no-op. If new parents are introduced
 * we add them (respecting cycle prevention, just like `link`).
 */
export async function runTopicsCreate(
  options: TopicsCreateOptions,
): Promise<TopicsCommandOutput> {
  const result = await createWikiTopic({
    cwd: options.cwd,
    wiki: options.wiki,
    name: options.name,
    parents: options.parents,
  });

  switch (result.status) {
    case "created":
      return {
        stdout: `created topic "${result.slug}"\n`,
        stderr: "",
        exitCode: 0,
      };
    case "updated":
      return {
        stdout: `updated topic "${result.slug}"\n`,
        stderr: "",
        exitCode: 0,
      };
    case "invalid-name":
      return {
        stdout: "",
        stderr: `almanac: topic name "${result.name}" has no slug-able characters\n`,
        exitCode: 1,
      };
    case "self-parent":
      return {
        stdout: "",
        stderr: `almanac: topic cannot be its own parent\n`,
        exitCode: 1,
      };
    case "missing-parent":
      return {
        stdout: "",
        stderr: `almanac: parent topic "${result.parent}" does not exist; create it first with \`almanac topics create ${result.parent}\`\n`,
        exitCode: 1,
      };
    case "cycle":
      return {
        stdout: "",
        stderr: `almanac: adding "${result.parent}" as a parent of "${result.slug}" would create a cycle\n`,
        exitCode: 1,
      };
  }
}
