import { createWikiTopic } from "../../../../services/wiki/topics.js";
import { renderTopicsCreate } from "./mutation-render.js";
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
  return renderTopicsCreate(
    await createWikiTopic({
      cwd: options.cwd,
      wiki: options.wiki,
      name: options.name,
      parents: options.parents,
    }),
  );
}
