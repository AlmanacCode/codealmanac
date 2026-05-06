import { runIndexer } from "../../indexer/index.js";
import { toKebabCase } from "../../slug.js";
import { ensureTopic, writeTopicsFile } from "../../topics/yaml.js";
import type { TopicsCommandOutput, TopicsDescribeOptions } from "./types.js";
import {
  closeWorkspace,
  openFreshTopicsWorkspace,
  resolveTopicsRepo,
  topicExists,
} from "./workspace.js";

/**
 * `almanac topics describe <slug> "<text>"`. Sets or updates the
 * one-liner description. An empty string clears it.
 */
export async function runTopicsDescribe(
  options: TopicsDescribeOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveTopicsRepo(options);
  const slug = toKebabCase(options.slug);
  if (slug.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }

  const workspace = await openFreshTopicsWorkspace(repoRoot);
  try {
    const { yamlPath, file, db } = workspace;
    if (!topicExists(file, db, slug)) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${slug}"\n`,
        exitCode: 1,
      };
    }
    // `ensureTopic` is idempotent — if the topic was DB-only it
    // promotes into `file`; if already in `file` it returns the
    // existing entry. Either way we get a concrete entry to mutate.
    const entry = ensureTopic(file, slug);

    const text = options.description.trim();
    entry.description = text.length === 0 ? null : text;

    await writeTopicsFile(yamlPath, file);
  } finally {
    closeWorkspace(workspace);
  }

  await runIndexer({ repoRoot: workspace.repoRoot });
  return {
    stdout: `described ${slug}\n`,
    stderr: "",
    exitCode: 0,
  };
}
