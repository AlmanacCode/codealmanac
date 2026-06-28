import type Database from "better-sqlite3";

import { toKebabCase } from "../../shared/slug.js";
import { runIndexer } from "../../stores/wiki/indexer/index.js";
import { resolveWikiRoot } from "../../stores/wiki/indexer/resolve-wiki.js";
import { ancestorsInFile } from "../../stores/wiki/topics/dag.js";
import { topicsYamlPath } from "../../stores/wiki/topics/paths.js";
import { topicTitleFromSlug } from "../../stores/wiki/topics/title.js";
import {
  ensureTopic,
  findTopic,
  type TopicEntry,
  type TopicsFile,
  writeTopicsFile,
} from "../../stores/wiki/topics/yaml.js";
import type {
  CreateWikiTopicRequest,
  CreateWikiTopicResult,
} from "./topic-types.js";
import {
  openEditableTopicWorkspace,
  topicExists,
} from "./topic-workspace.js";

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

    const title = requestedTopicTitle(request.name, slug);
    const existing = findTopic(file, slug);

    if (existing === null) {
      file.topics.push({
        slug,
        title,
        description: null,
        parents: requestedParents,
      });
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

function normalizeTopicSlugs(values: string[]): string[] {
  return values
    .map((value) => toKebabCase(value))
    .filter((slug) => slug.length > 0);
}

function requestedTopicTitle(name: string, slug: string): string {
  return name.trim().length > 0
    ? name.trim()
    : topicTitleFromSlug(slug);
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
  const defaultTitle = topicTitleFromSlug(topic.slug);
  if (
    topic.title === defaultTitle &&
    candidateTitle !== defaultTitle &&
    candidateTitle !== topic.title
  ) {
    topic.title = candidateTitle;
  }
}
