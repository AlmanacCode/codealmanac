---
page_id: architecture-topic-dag
title: Topic DAG Architecture
summary: Topic services read indexed topic views and deterministically mutate `topics.yaml` and page frontmatter.
topics: [architecture, storage]
sources:
  - id: topics-service
    type: file
    path: src/codealmanac/services/topics/service.py
  - id: topic-mutations
    type: file
    path: src/codealmanac/services/topics/mutations.py
  - id: topic-graph
    type: file
    path: src/codealmanac/services/topics/graph.py
---

# Topic DAG Architecture

The topic subsystem has a read side and a deterministic mutation side. `TopicsService` lists and shows topics through the index, while `TopicMutationExecutor` changes topic definitions and page frontmatter through explicit verbs such as create, describe, link, unlink, rename, and delete. [@topics-service] [@topic-mutations]

## What invariants does it protect?

The graph helpers require parent topics to exist, reject self-parent edges, and reject cycles. [@topic-graph]

## How does it update pages?

Rename and delete operations rewrite page frontmatter rather than editing prose. This matches the product rule that organization commands may rewrite metadata deterministically but should not write page body prose. [@topic-mutations]

## What explains the idea?

Read `[[concept-topic-dag]]` first, then use `[[reference-topics-yaml]]` for the exact topic file shape.

