---
page_id: reference-index-schema
title: Index Schema
summary: This page lists the SQLite tables and virtual table used by the derived index.
topics: [reference, storage]
sources:
  - id: index-schema
    type: file
    path: src/codealmanac/services/index/schema.py
---

# Index Schema

The derived index uses SQLite tables for pages, topics, relationships, references, sources, links, and metadata, plus an FTS5 virtual table for search. [@index-schema]

## Tables

| Table | Purpose |
|---|---|
| `pages` | Page body and metadata. |
| `topics` | Topic definitions. |
| `page_topics` | Page-to-topic membership. |
| `topic_parents` | Topic DAG edges. |
| `file_refs` | File and folder references. |
| `page_sources` | Structured source citations. |
| `wikilinks` | Page-to-page links. |
| `cross_wiki_links` | Cross-wiki page links. |
| `fts_pages` | Full-text search rows. |
| `index_metadata` | Stored source signature and metadata. |

## Related pages

Read `[[architecture-index-read-model]]` for how the schema is populated.

