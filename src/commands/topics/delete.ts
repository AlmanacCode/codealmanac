import { runIndexer } from "../../indexer/index.js";
import { toKebabCase } from "../../slug.js";
import { writeTopicsFile } from "../../topics/yaml.js";
import { rewriteTopicOnPages } from "./page-rewrite.js";
import type { TopicsCommandOutput, TopicsDeleteOptions } from "./types.js";
import {
  closeWorkspace,
  openFreshTopicsWorkspace,
  resolveTopicsRepo,
  topicExists,
} from "./workspace.js";

/**
 * `almanac topics delete <slug>`. Removes the topic from `topics.yaml`
 * (if present), scrubs any parent edges pointing at it, and untags
 * every page that had it. Pages themselves are left alone — deleting a
 * topic doesn't delete pages, just the relationship.
 */
export async function runTopicsDelete(
  options: TopicsDeleteOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveTopicsRepo(options);
  const slug = toKebabCase(options.slug);
  if (slug.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }

  const workspace = await openFreshTopicsWorkspace(repoRoot);
  let pagesUpdated: number;
  try {
    const { repoRoot, yamlPath, file, db } = workspace;
    if (!topicExists(file, db, slug)) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${slug}"\n`,
        exitCode: 1,
      };
    }

    // Remove the entry and strip it from everyone else's `parents` list.
    file.topics = file.topics.filter((t) => t.slug !== slug);
    for (const t of file.topics) {
      t.parents = t.parents.filter((p) => p !== slug);
    }

    // Same write ordering as rename: topics.yaml first (atomic), then
    // pages. A crash between the two leaves topics.yaml already scrubbed
    // and any remaining in-page references become ad-hoc topics — which
    // the reindex will pick up as empty-topics on next health, and the
    // user can re-run to finish untagging.
    await writeTopicsFile(yamlPath, file);

    pagesUpdated = await rewriteTopicOnPages(repoRoot, (topics) =>
      topics.filter((t) => t !== slug),
    );
  } finally {
    closeWorkspace(workspace);
  }

  await runIndexer({ repoRoot: workspace.repoRoot });
  return {
    stdout: `deleted topic "${slug}" (${pagesUpdated} page${pagesUpdated === 1 ? "" : "s"} untagged)\n`,
    stderr: "",
    exitCode: 0,
  };
}
