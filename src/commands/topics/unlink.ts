import { runIndexer } from "../../indexer/index.js";
import { resolveWikiRoot } from "../../indexer/resolve-wiki.js";
import { toKebabCase } from "../../slug.js";
import { topicsYamlPath } from "../../topics/paths.js";
import {
  findTopic,
  loadTopicsFile,
  writeTopicsFile,
} from "../../topics/yaml.js";
import type { TopicsCommandOutput, TopicsUnlinkOptions } from "./types.js";

/**
 * `almanac topics unlink <child> <parent>`. Removes a DAG edge if it
 * exists. No-op (exit 0) if not. Never deletes topics.
 */
export async function runTopicsUnlink(
  options: TopicsUnlinkOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const child = toKebabCase(options.child);
  const parent = toKebabCase(options.parent);
  if (child.length === 0 || parent.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }
  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const childEntry = findTopic(file, child);
  if (childEntry === null || !childEntry.parents.includes(parent)) {
    return {
      stdout: `no edge ${child} → ${parent}\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  childEntry.parents = childEntry.parents.filter((p) => p !== parent);
  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: `unlinked ${child} → ${parent}\n`,
    stderr: "",
    exitCode: 0,
  };
}
