---
page_id: decision-sqlite-derived-index
title: SQLite Derived Index
summary: SQLite is a rebuildable read model for committed markdown, not the source of truth.
topics: [decisions, storage]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: index-service
    type: file
    path: src/codealmanac/services/index/service.py
  - id: index-store
    type: file
    path: src/codealmanac/services/index/store.py
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
---

# SQLite Derived Index

SQLite is the derived read model for wiki markdown and topics. Query services ensure the index is fresh, and the store rebuilds projection tables from source pages and `topics.yaml` when the source signature changes. [@index-service] [@index-store]

## Status

Accepted. [@manual]

## Context

Markdown files are the committed source of truth. Search, topic lookup, backlinks, health, and the viewer need fast structured reads that markdown alone cannot provide. [@manual] [@index-service]

## Decision

We will keep `index.db` as local derived state under the Almanac root. [@manual]

## Consequences

The database can be rebuilt. SQLite access belongs in the database and index packages, and architecture tests prevent raw SQLite imports from spreading through the codebase. [@architecture-tests] See `[[architecture-index-read-model]]`.

