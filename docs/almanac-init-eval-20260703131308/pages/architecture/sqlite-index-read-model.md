---
title: SQLite Index Read Model
topics: [architecture, index]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
  - id: sources
    type: file
    path: src/codealmanac/services/index/sources.py
  - id: projection
    type: file
    path: src/codealmanac/services/index/projection.py
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# SQLite Index Read Model

The SQLite index is a derived read model from committed wiki source. It stores pages, topics, page-topic edges, topic-parent edges, file refs, page sources, wikilinks, cross-wiki links, FTS content, and metadata in `<almanac-root>/index.db` [@schema].

`load_index_sources()` scans `pages/**/*.md`, skips duplicate slugs, reads `topics.yaml`, and builds a source signature from page content hashes plus the topics hash [@sources]. Projection replaces derived rows and stores the signature; the index can be rebuilt because source Markdown remains the authority [@projection].

Read-side SQL is split by query family, while schema and projection own write-side mechanics [@agreement]. Use [[index-schema-reference]] for table details and [[change-the-index-guide]] before changing parsing or projection.
