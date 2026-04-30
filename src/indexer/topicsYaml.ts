import { existsSync } from "node:fs";

import type Database from "better-sqlite3";

import { loadTopicsFile } from "../topics/yaml.js";

export const TOPICS_YAML_FILENAME = "topics.yaml";

/**
 * Apply the contents of `.almanac/topics.yaml` to SQLite.
 *
 * Called at the tail of every reindex. For each entry in the file we
 * upsert a row into `topics` and rewrite that topic's parent edges.
 * Topics that exist only in page frontmatter remain legal ad-hoc topics.
 */
export async function applyTopicsYaml(
  db: Database.Database,
  topicsYamlPath: string,
): Promise<void> {
  if (!existsSync(topicsYamlPath)) return;
  let file;
  try {
    file = await loadTopicsFile(topicsYamlPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`almanac: ${message}\n`);
    return;
  }

  const upsertTopic = db.prepare<[string, string, string | null]>(
    `INSERT INTO topics (slug, title, description) VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       title = excluded.title,
       description = excluded.description`,
  );
  const clearParents = db.prepare<[string]>(
    "DELETE FROM topic_parents WHERE child_slug = ?",
  );
  const insertParent = db.prepare<[string, string]>(
    "INSERT OR IGNORE INTO topic_parents (child_slug, parent_slug) VALUES (?, ?)",
  );

  const declared = new Set<string>();
  for (const t of file.topics) declared.add(t.slug);
  const adHoc = db
    .prepare<[], { topic_slug: string }>(
      "SELECT DISTINCT topic_slug FROM page_topics",
    )
    .all();
  for (const r of adHoc) declared.add(r.topic_slug);

  const apply = db.transaction(() => {
    for (const t of file.topics) {
      upsertTopic.run(t.slug, t.title, t.description);
      clearParents.run(t.slug);
      for (const parent of t.parents) {
        if (parent === t.slug) continue;
        insertParent.run(t.slug, parent);
      }
    }

    const existing = db
      .prepare<[], { slug: string }>("SELECT slug FROM topics")
      .all();
    const deleteTopic = db.prepare<[string]>("DELETE FROM topics WHERE slug = ?");
    const deleteEdgesByChild = db.prepare<[string]>(
      "DELETE FROM topic_parents WHERE child_slug = ?",
    );
    const deleteEdgesByParent = db.prepare<[string]>(
      "DELETE FROM topic_parents WHERE parent_slug = ?",
    );
    for (const r of existing) {
      if (declared.has(r.slug)) continue;
      deleteEdgesByChild.run(r.slug);
      deleteEdgesByParent.run(r.slug);
      deleteTopic.run(r.slug);
    }
  });
  apply();
}
