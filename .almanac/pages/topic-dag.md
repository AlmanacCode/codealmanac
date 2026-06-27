---
title: Topic DAG
summary: >-
  Topics are a multi-parent DAG stored in `.almanac/topics.yaml`, while page membership stays in
  frontmatter and is reconciled at query time.
topics:
  - systems
  - cli
sources:
  - id: yaml
    type: file
    path: src/wiki/topics/yaml.ts
    note: Migrated from legacy files.
  - id: dag
    type: file
    path: src/wiki/topics/dag.ts
    note: Migrated from legacy files.
  - id: frontmatter-rewrite
    type: file
    path: src/wiki/topics/frontmatter-rewrite.ts
    note: Migrated from legacy files.
  - id: paths
    type: file
    path: src/wiki/topics/paths.ts
    note: Migrated from legacy files.
  - id: schema
    type: file
    path: src/wiki/indexer/schema.ts
    note: Migrated from legacy files.
  - id: index
    type: file
    path: src/cli/commands/topics/index.ts
    note: Migrated from legacy files.
  - id: topics-service
    type: file
    path: src/services/wiki/topics.ts
    note: Public service facade for topic command adapters.
  - id: topic-read-service
    type: file
    path: src/services/wiki/topic-read.ts
    note: Read-side topic workflows for list/show.
  - id: topic-description-service
    type: file
    path: src/services/wiki/topic-description.ts
    note: Description mutation workflow for topics describe.
  - id: topic-graph-mutations-service
    type: file
    path: src/services/wiki/topic-graph-mutations.ts
    note: Graph metadata workflows for topics create/link/unlink.
  - id: topic-page-mutations-service
    type: file
    path: src/services/wiki/topic-page-mutations.ts
    note: Page-rewriting workflows for topics rename/delete.
  - id: topic-workspace-service
    type: file
    path: src/services/wiki/topic-workspace.ts
    note: Internal service helper for fresh topic index and YAML workspace.
  - id: topic-page-rewrite-service
    type: file
    path: src/services/wiki/topic-page-rewrite.ts
    note: Service helper for rewriting page frontmatter during topic mutations.
  - id: page-topic-mutations-service
    type: file
    path: src/services/wiki/page-topic-mutations.ts
    note: Service workflow for tag/untag page-topic mutations.
  - id: page-topic-pages-service
    type: file
    path: src/services/wiki/page-topic-pages.ts
    note: Page input parsing and indexed page-file resolution for tag workflows.
  - id: page-topic-types-service
    type: file
    path: src/services/wiki/page-topic-types.ts
    note: Request and result contracts for page-topic service workflows.
  - id: tag
    type: file
    path: src/cli/commands/tag.ts
    note: CLI adapter for tag/untag rendering.

---

# Topic DAG

Topics form a directed acyclic graph (DAG) serialized to `.almanac/topics.yaml`. Pages carry a `topics:` array in frontmatter; the DAG defines parent-child relationships between topics. A page can belong to multiple topics; a topic can have multiple parents. Topics classify reading neighborhoods; [[wiki-organization-primitives]] explains why dense neighborhoods still need anchors and hubs.

## Storage split

Topic metadata (slug, title, description, parents) lives in `topics.yaml`. Which pages belong to which topics lives in page frontmatter. The [[sqlite-indexer]] reconciles both into SQLite (`topics`, `page_topics`, `topic_parents` tables) on every reindex.

`page_topics.topic_slug` has no FK to `topics(slug)`. Topics can be declared in page frontmatter before they exist in `topics.yaml`; a strict FK would force upsert ordering that buys nothing and would prevent the "no explicit topic registration required" shorthand. Dead topic references are surfaced by `almanac health`.

## Cycle prevention

Three layers:
1. `CHECK (child_slug != parent_slug)` constraint in `topic_parents`
2. Pre-insert cycle check in `src/wiki/topics/dag.ts` before `almanac topics link` runs
3. Depth cap of 32 on any recursive CTE that traverses the DAG

## Frontmatter rewrite

`almanac topics rename <old> <new>` and `almanac untag <page> <topic>` rewrite affected pages' frontmatter in place. `src/wiki/topics/frontmatter-rewrite.ts` handles this — it parses only the YAML block, patches the `topics:` array, and rewrites the file atomically to avoid corrupting prose. `src/services/wiki/topic-page-mutations.ts` owns the topic rename/delete workflows that coordinate topic metadata with page-frontmatter rewrites. `src/services/wiki/page-topic-mutations.ts` owns the `tag`/`untag` product workflow, while `src/services/wiki/page-topic-pages.ts` owns input parsing and page slug-to-file resolution through the query layer.

## CLI surface

`almanac topics list` — all topics with page counts.
`almanac topics show <slug> --descendants` — walks the subgraph and returns all pages in the topic and its descendants.
`almanac topics create/link/unlink/rename/delete/describe` — mutation commands; all update `topics.yaml` and trigger a reindex on the next query.
`almanac tag <page> <topic>` — adds topics to a page's frontmatter; auto-creates missing topics.
