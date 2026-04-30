import type Database from "better-sqlite3";

import { ensureFreshIndex } from "../../indexer/index.js";
import { resolveWikiRoot } from "../../indexer/resolve-wiki.js";
import { openIndex } from "../../indexer/schema.js";
import { indexDbPath, topicsYamlPath } from "../../topics/paths.js";
import {
  findTopic,
  loadTopicsFile,
  type TopicsFile,
} from "../../topics/yaml.js";

interface TopicsRepoOptions {
  cwd: string;
  wiki?: string;
}

export interface TopicsWorkspace {
  repoRoot: string;
  yamlPath: string;
  file: TopicsFile;
  db: Database.Database;
}

export function resolveTopicsRepo(options: TopicsRepoOptions): Promise<string> {
  return resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
}

/**
 * Shared setup path for mutating topic commands. These commands all need
 * a fresh DB view so ad-hoc topics from page frontmatter can be promoted
 * into `topics.yaml` before mutation.
 */
export async function openFreshTopicsWorkspace(
  repoRoot: string,
): Promise<TopicsWorkspace> {
  await ensureFreshIndex({ repoRoot });

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const db = openIndex(indexDbPath(repoRoot));
  return { repoRoot, yamlPath, file, db };
}

export function closeWorkspace(workspace: TopicsWorkspace): void {
  workspace.db.close();
}

/**
 * Is `slug` a known topic anywhere — in `topics.yaml`, or as an ad-hoc
 * slug that a page's frontmatter mentioned and the indexer seeded?
 */
export function topicExists(
  file: TopicsFile,
  db: Database.Database,
  slug: string,
): boolean {
  if (findTopic(file, slug) !== null) return true;
  const row = db
    .prepare<[string], { slug: string }>(
      "SELECT slug FROM topics WHERE slug = ?",
    )
    .get(slug);
  return row !== undefined;
}
