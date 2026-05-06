import { runIndexer } from "../../indexer/index.js";
import { toKebabCase } from "../../slug.js";
import { ancestorsInFile } from "../../topics/dag.js";
import {
  ensureTopic,
  findTopic,
  writeTopicsFile,
} from "../../topics/yaml.js";
import type { TopicsCommandOutput, TopicsLinkOptions } from "./types.js";
import {
  closeWorkspace,
  openFreshTopicsWorkspace,
  resolveTopicsRepo,
  topicExists,
} from "./workspace.js";

/**
 * `almanac topics link <child> <parent>`. Adds a DAG edge after
 * checking that it wouldn't close a cycle. Both topics must exist.
 */
export async function runTopicsLink(
  options: TopicsLinkOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveTopicsRepo(options);
  const child = toKebabCase(options.child);
  const parent = toKebabCase(options.parent);
  if (child.length === 0 || parent.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }
  if (child === parent) {
    return {
      stdout: "",
      stderr: `almanac: topic cannot be its own parent\n`,
      exitCode: 1,
    };
  }

  const workspace = await openFreshTopicsWorkspace(repoRoot);
  try {
    const { repoRoot, yamlPath, file, db } = workspace;
    for (const slug of [child, parent]) {
      if (!topicExists(file, db, slug)) {
        return {
          stdout: "",
          stderr: `almanac: topic "${slug}" does not exist\n`,
          exitCode: 1,
        };
      }
      if (findTopic(file, slug) === null) {
        // DB-only ad-hoc topic → promote it into topics.yaml so the
        // new DAG edge has a concrete home.
        ensureTopic(file, slug);
      }
    }

    const childEntry = findTopic(file, child);
    if (childEntry === null) {
      // Shouldn't happen after ensureTopic above — defensive.
      return {
        stdout: "",
        stderr: `almanac: topic "${child}" not found\n`,
        exitCode: 1,
      };
    }

    if (childEntry.parents.includes(parent)) {
      return {
        stdout: `edge ${child} → ${parent} already exists\n`,
        stderr: "",
        exitCode: 0,
      };
    }

    // Cycle check BEFORE mutation. Uses the in-memory file so the check
    // operates on the state we're about to write — no DB round-trip needed.
    const parentAncestors = ancestorsInFile(file, parent);
    if (parentAncestors.has(child) || parent === child) {
      return {
        stdout: "",
        stderr: `almanac: adding ${parent} as parent of ${child} would create a cycle\n`,
        exitCode: 1,
      };
    }

    childEntry.parents.push(parent);
    await writeTopicsFile(yamlPath, file);
    await runIndexer({ repoRoot });
    return {
      stdout: `linked ${child} → ${parent}\n`,
      stderr: "",
      exitCode: 0,
    };
  } finally {
    closeWorkspace(workspace);
  }
}
