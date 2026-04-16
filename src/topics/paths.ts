import { join } from "node:path";

/**
 * `.almanac/topics.yaml` inside a given repo root. Single helper so no
 * caller has to remember where the file lives.
 */
export function topicsYamlPath(repoRoot: string): string {
  return join(repoRoot, ".almanac", "topics.yaml");
}

/**
 * `.almanac/index.db` inside a given repo root. Mirrors `topicsYamlPath`
 * so the topics commands don't have to import from scattered places.
 */
export function indexDbPath(repoRoot: string): string {
  return join(repoRoot, ".almanac", "index.db");
}
