import type Database from "better-sqlite3";

import { toKebabCase } from "../../slug.js";
import { runIndexer } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import * as query from "../../wiki/query/index.js";
import { ancestorsInFile } from "../../wiki/topics/dag.js";
import { topicsYamlPath } from "../../wiki/topics/paths.js";
import {
  ensureTopic,
  findTopic,
  loadTopicsFile,
  titleCase,
  type TopicEntry,
  type TopicsFile,
  writeTopicsFile,
} from "../../wiki/topics/yaml.js";
import type {
  CreateWikiTopicRequest,
  CreateWikiTopicResult,
  DescribeWikiTopicRequest,
  DescribeWikiTopicResult,
  LinkWikiTopicsRequest,
  LinkWikiTopicsResult,
  UnlinkWikiTopicsRequest,
  UnlinkWikiTopicsResult,
} from "./topic-types.js";
import {
  openEditableTopicWorkspace,
  openFreshTopicIndex,
  topicExists,
} from "./topic-workspace.js";

export async function describeWikiTopic(
  request: DescribeWikiTopicRequest,
): Promise<DescribeWikiTopicResult> {
  const slug = toKebabCase(request.slug);
  if (slug.length === 0) return { status: "empty-slug" };

  const { repoRoot, db } = await openFreshTopicIndex(request);
  try {
    const detail = query.topics.topicDetail(db, slug);
    if (detail === null) return { status: "missing", slug };

    const yamlPath = topicsYamlPath(repoRoot);
    const file = await loadTopicsFile(yamlPath);
    const entry = ensureTopic(file, slug);
    const text = request.description.trim();
    entry.description = text.length === 0 ? null : text;

    await writeTopicsFile(yamlPath, file);
  } finally {
    db.close();
  }

  await runIndexer({ repoRoot });
  return { status: "described", slug };
}

export async function createWikiTopic(
  request: CreateWikiTopicRequest,
): Promise<CreateWikiTopicResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const slug = toKebabCase(request.name);
  if (slug.length === 0) {
    return { status: "invalid-name", name: request.name };
  }

  const { file, db } = await openEditableTopicWorkspace(repoRoot);
  try {
    const requestedParents = normalizeTopicSlugs(request.parents ?? []);
    const validation = promoteAndValidateTopicParents({
      file,
      db,
      topicSlug: slug,
      requestedParents,
    });
    if (validation !== null) return validation;

    const title = request.name.trim().length > 0
      ? request.name.trim()
      : titleCase(slug);
    const existing = findTopic(file, slug);

    if (existing === null) {
      const entry: TopicEntry = {
        slug,
        title,
        description: null,
        parents: requestedParents,
      };
      file.topics.push(entry);
    } else {
      const addParents = addParentsToTopic(file, existing, requestedParents);
      if (addParents !== null) return addParents;
      maybePromoteTopicTitle(existing, title);
    }

    await writeTopicsFile(topicsYamlPath(repoRoot), file);
    await runIndexer({ repoRoot });
    return { status: existing === null ? "created" : "updated", slug };
  } finally {
    db.close();
  }
}

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

function normalizeTopicSlugs(values: string[]): string[] {
  return values
    .map((value) => toKebabCase(value))
    .filter((slug) => slug.length > 0);
}

function promoteAndValidateTopicParents(params: {
  file: TopicsFile;
  db: Database.Database;
  topicSlug: string;
  requestedParents: string[];
}): CreateWikiTopicResult | null {
  for (const parent of params.requestedParents) {
    if (parent === params.topicSlug) {
      return { status: "self-parent" };
    }
    if (!topicExists(params.file, params.db, parent)) {
      return { status: "missing-parent", parent };
    }
    if (findTopic(params.file, parent) === null) {
      ensureTopic(params.file, parent);
    }
  }
  return null;
}

function addParentsToTopic(
  file: TopicsFile,
  topic: TopicEntry,
  requestedParents: string[],
): CreateWikiTopicResult | null {
  for (const parent of requestedParents) {
    if (topic.parents.includes(parent)) continue;
    const ancestors = ancestorsInFile(file, parent);
    if (ancestors.has(topic.slug)) {
      return { status: "cycle", slug: topic.slug, parent };
    }
    topic.parents.push(parent);
  }
  return null;
}

function maybePromoteTopicTitle(topic: TopicEntry, candidateTitle: string): void {
  const defaultTitle = titleCase(topic.slug);
  if (
    topic.title === defaultTitle &&
    candidateTitle !== defaultTitle &&
    candidateTitle !== topic.title
  ) {
    topic.title = candidateTitle;
  }
}
