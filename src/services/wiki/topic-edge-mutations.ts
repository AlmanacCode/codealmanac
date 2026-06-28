import { toKebabCase } from "../../shared/slug.js";
import { runIndexer } from "../../stores/wiki/indexer/index.js";
import { resolveWikiRoot } from "../../stores/wiki/indexer/resolve-wiki.js";
import { ancestorsInFile } from "../../stores/wiki/topics/dag.js";
import { topicsYamlPath } from "../../stores/wiki/topics/paths.js";
import {
  ensureTopic,
  findTopic,
  loadTopicsFile,
  writeTopicsFile,
} from "../../stores/wiki/topics/yaml.js";
import type {
  LinkWikiTopicsRequest,
  LinkWikiTopicsResult,
  UnlinkWikiTopicsRequest,
  UnlinkWikiTopicsResult,
} from "./topic-types.js";
import {
  openEditableTopicWorkspace,
  topicExists,
} from "./topic-workspace.js";

export async function linkWikiTopics(
  request: LinkWikiTopicsRequest,
): Promise<LinkWikiTopicsResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const child = toKebabCase(request.child);
  const parent = toKebabCase(request.parent);
  if (child.length === 0 || parent.length === 0) {
    return { status: "empty-slug" };
  }
  if (child === parent) return { status: "self-parent" };

  const { file, db } = await openEditableTopicWorkspace(repoRoot);
  try {
    for (const slug of [child, parent]) {
      if (!topicExists(file, db, slug)) {
        return { status: "missing-topic", slug };
      }
      if (findTopic(file, slug) === null) {
        ensureTopic(file, slug);
      }
    }

    const childEntry = findTopic(file, child);
    if (childEntry === null) {
      return { status: "missing-topic", slug: child };
    }

    if (childEntry.parents.includes(parent)) {
      return { status: "already-exists", child, parent };
    }

    const parentAncestors = ancestorsInFile(file, parent);
    if (parentAncestors.has(child)) {
      return { status: "cycle", child, parent };
    }

    childEntry.parents.push(parent);
    await writeTopicsFile(topicsYamlPath(repoRoot), file);
    await runIndexer({ repoRoot });
    return { status: "linked", child, parent };
  } finally {
    db.close();
  }
}

export async function unlinkWikiTopics(
  request: UnlinkWikiTopicsRequest,
): Promise<UnlinkWikiTopicsResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const child = toKebabCase(request.child);
  const parent = toKebabCase(request.parent);
  if (child.length === 0 || parent.length === 0) {
    return { status: "empty-slug" };
  }

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const childEntry = findTopic(file, child);
  if (childEntry === null || !childEntry.parents.includes(parent)) {
    return { status: "no-edge", child, parent };
  }

  childEntry.parents = childEntry.parents.filter((p) => p !== parent);
  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return { status: "unlinked", child, parent };
}
