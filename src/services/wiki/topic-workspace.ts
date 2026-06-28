import type Database from "better-sqlite3";
import { join } from "node:path";

import { ensureFreshIndex } from "../../stores/wiki/indexer/index.js";
import { resolveWikiRoot } from "../../stores/wiki/indexer/resolve-wiki.js";
import { openIndex } from "../../stores/wiki/indexer/schema.js";
import { topics as topicQueries } from "../../stores/wiki/query/index.js";
import { topicsYamlPath } from "../../stores/wiki/topics/paths.js";
import {
  findTopic,
  loadTopicsFile,
  type TopicsFile,
} from "../../stores/wiki/topics/yaml.js";
import type { WikiTopicsRequest } from "./topic-types.js";

export interface FreshTopicIndex {
  repoRoot: string;
  db: Database.Database;
}

export interface EditableTopicWorkspace {
  repoRoot: string;
  db: Database.Database;
  file: TopicsFile;
}

export async function openFreshTopicIndex(
  request: WikiTopicsRequest,
): Promise<FreshTopicIndex> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  await ensureFreshIndex({ repoRoot });
  return { repoRoot, db: openIndex(join(repoRoot, ".almanac", "index.db")) };
}

export async function openEditableTopicWorkspace(
  repoRoot: string,
): Promise<EditableTopicWorkspace> {
  await ensureFreshIndex({ repoRoot });
  const file = await loadTopicsFile(topicsYamlPath(repoRoot));
  return {
    repoRoot,
    db: openIndex(join(repoRoot, ".almanac", "index.db")),
    file,
  };
}

export function topicExists(
  file: TopicsFile,
  db: Database.Database,
  slug: string,
): boolean {
  if (findTopic(file, slug) !== null) return true;
  return topicQueries.topicExistsInDb(db, slug);
}
