---
page_id: architecture-index-read-model
title: Index Read Model
summary: The index is a derived SQLite projection of pages and topics that powers search, show, topics, health, and the viewer.
topics: [architecture, storage]
sources:
  - id: index-service
    type: file
    path: src/codealmanac/services/index/service.py
  - id: index-store
    type: file
    path: src/codealmanac/services/index/store.py
  - id: index-sources
    type: file
    path: src/codealmanac/services/index/sources.py
  - id: index-schema
    type: file
    path: src/codealmanac/services/index/schema.py
---

# Index Read Model

The index read model is a derived SQLite database under the Almanac root. It loads page documents and topics, stores a source signature, writes projection tables, and serves search, page, topic, summary, and health queries after ensuring the index is fresh. [@index-service] [@index-store] [@index-sources] [@index-schema]

## When does the index refresh?

Read services call `ensure_fresh()` before returning indexed data. The store compares the stored source signature with the current page and topic signature before rebuilding the projection. [@index-service] [@index-store]

## What does the schema store?

The schema stores pages, topics, page-topic edges, topic-parent edges, file references, page sources, wikilinks, cross-wiki links, FTS rows, and index metadata. [@index-schema]

## What should I read next?

See `[[reference-index-schema]]` for the exact tables and `[[architecture-topic-dag]]` for topic graph behavior.

