---
title: Topic DAG
topics: [systems, cli]
files:
  - src/topics/yaml.ts
  - src/topics/dag.ts
  - src/topics/frontmatter-rewrite.ts
  - src/topics/paths.ts
  - src/indexer/schema.ts
  - src/commands/topics.ts
  - src/commands/tag.ts
---

# Topic DAG

Topics form a directed acyclic graph (DAG) serialized to `.almanac/topics.yaml`. Pages carry a `topics:` array in frontmatter; the DAG defines parent-child relationships between topics. A page can belong to multiple topics; a topic can have multiple parents.

<!-- stub: fill in DAG traversal gotchas and frontmatter rewrite behavior as discovered -->

## Storage split

Topic metadata (slug, title, description, parents) lives in `topics.yaml`. Which pages belong to which topics lives in page frontmatter. The indexer reconciles both into SQLite (`topics`, `page_topics`, `topic_parents` tables) on every reindex.

## Cycle prevention

Three layers:
1. `CHECK (child_slug != parent_slug)` constraint in `topic_parents`
2. Pre-insert cycle check in `src/topics/dag.ts` before `almanac topics link` runs
3. Depth cap of 32 on any recursive CTE that traverses the DAG

## Frontmatter rewrite

`almanac topics rename <old> <new>` and `almanac untag <page> <topic>` rewrite affected pages' frontmatter in place. `src/topics/frontmatter-rewrite.ts` handles this — it parses only the YAML block, patches the `topics:` array, and rewrites the file atomically to avoid corrupting prose.

## CLI surface

`almanac topics list` — all topics with page counts.
`almanac topics show <slug> --descendants` — walks the subgraph and returns all pages in the topic and its descendants.
`almanac topics create/link/unlink/rename/delete/describe` — mutation commands; all update `topics.yaml` and trigger a reindex on the next query.
`almanac tag <page> <topic>` — adds topics to a page's frontmatter; auto-creates missing topics.
