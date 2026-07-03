---
page_id: concept-topic-dag
title: Topic DAG
summary: Topics organize pages as a directed acyclic graph rather than as one folder tree.
topics: [concepts, storage]
sources:
  - id: concepts-doc
    type: file
    path: docs/concepts.md
  - id: topic-graph
    type: file
    path: src/codealmanac/services/topics/graph.py
  - id: topic-mutations
    type: file
    path: src/codealmanac/services/topics/mutations.py
---

# Topic DAG

The topic model is a directed acyclic graph: a page can have multiple topics, and a topic can have multiple parents. CodeAlmanac validates parent existence, rejects self-parent edges, and prevents cycles when topic relationships are changed. [@concepts-doc] [@topic-graph] [@topic-mutations]

## Why not use folders as the taxonomy?

Folders can only place a page in one visible branch. Topics allow one page to belong to several neighborhoods, such as architecture, lifecycle, and storage.

## Where are topics stored?

Topic definitions live in `<almanac-root>/topics.yaml`, while page membership lives in each page's `topics:` frontmatter. [@concepts-doc]

## What should I read next?

Read `[[architecture-topic-dag]]` for the implementation and `[[reference-topics-yaml]]` for the file shape.

