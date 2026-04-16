import type Database from "better-sqlite3";

import type { TopicsFile } from "./yaml.js";

/**
 * Depth cap for all recursive traversals of the topics DAG. Belt and
 * suspenders alongside the `CHECK (child_slug != parent_slug)` on the
 * `topic_parents` table — even if a cycle somehow slipped into the data
 * (hand-edited `topics.yaml`, past bug), the CTE can't runaway.
 *
 * 32 is chosen as "deeper than any real human-authored taxonomy will
 * ever go". A 32-level topic hierarchy is absurd; anything hitting this
 * cap is almost certainly a cycle.
 */
export const DAG_DEPTH_CAP = 32;

/**
 * Given a `topics.yaml` in memory, compute the set of ancestors of a
 * given slug (not including the slug itself). Used by `topics link`
 * to check whether a proposed edge would create a cycle.
 *
 * Running off the in-memory file lets `link` validate BEFORE touching
 * either the DB or the YAML, so a refusal doesn't leave half the state
 * mutated. Depth-capped with the same constant as the SQLite CTE.
 */
export function ancestorsInFile(
  file: TopicsFile,
  slug: string,
): Set<string> {
  // Build a child → parents map once.
  const parentsOf = new Map<string, string[]>();
  for (const t of file.topics) {
    parentsOf.set(t.slug, t.parents);
  }
  const ancestors = new Set<string>();
  // BFS, depth-capped. We stop descending when we've hit the cap or
  // revisit an already-seen node (self-loop defense).
  let frontier: string[] = parentsOf.get(slug) ?? [];
  let depth = 0;
  while (frontier.length > 0 && depth < DAG_DEPTH_CAP) {
    const next: string[] = [];
    for (const node of frontier) {
      if (ancestors.has(node)) continue;
      ancestors.add(node);
      const ps = parentsOf.get(node);
      if (ps !== undefined) next.push(...ps);
    }
    frontier = next;
    depth += 1;
  }
  return ancestors;
}

/**
 * Return all descendants of a given topic slug via the SQLite
 * `topic_parents` table. Depth-capped at `DAG_DEPTH_CAP`.
 *
 * Used by `topics show --descendants` to expand a topic's page list
 * through its subtopics. The query is a canonical recursive CTE; we
 * `UNION` (not `UNION ALL`) so cycles in the data don't spin forever.
 */
export function descendantsInDb(
  db: Database.Database,
  slug: string,
): string[] {
  const rows = db
    .prepare<[string, number], { slug: string }>(
      `WITH RECURSIVE desc(slug, depth) AS (
         SELECT child_slug, 1 FROM topic_parents WHERE parent_slug = ?
         UNION
         SELECT tp.child_slug, d.depth + 1
         FROM topic_parents tp
         JOIN desc d ON tp.parent_slug = d.slug
         WHERE d.depth < ?
       )
       SELECT DISTINCT slug FROM desc ORDER BY slug`,
    )
    .all(slug, DAG_DEPTH_CAP)
    .map((r) => r.slug);
  return rows;
}

/**
 * Return the subtree rooted at `slug` (the slug itself + all
 * descendants). Convenience wrapper used by `health --topic` to scope
 * reports through the DAG.
 */
export function subtreeInDb(db: Database.Database, slug: string): string[] {
  return [slug, ...descendantsInDb(db, slug)];
}
