---
title: Indexing
summary: The SQLite index is a derived read model over the Markdown wiki tree.
topics: [architecture, storage, wiki-design]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: SQLite schema and current index database path.
  - id: projection
    type: file
    path: src/codealmanac/services/index/projection.py
    note: Projection from page documents and topics into SQLite tables.
  - id: documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: Page document loading and source-derived file references.
  - id: health
    type: file
    path: src/codealmanac/services/index/health_views.py
    note: Health report read model.
---

# Indexing

The index is derived state. `src/codealmanac/services/index/schema.py` currently stores the database at `almanac/index.db` and recreates the derived schema through one migration version [@schema].

The schema includes pages, topics, page-topic edges, topic-parent edges, file references, page sources, page links, cross-wiki links, FTS5 content, and index metadata [@schema]. The projection deletes and rebuilds those tables from loaded page documents and topic definitions [@projection].

Page documents load title, summary, topics, sources, file references, page links, and body from Markdown files [@documents]. File references come from `sources:` file entries and inline file links until Markdown link parsing replaces wikilink extraction in Ticket 4.

Health views read the derived tables to report graph and source problems [@health]. Ticket 6 turns that health surface into the public `codealmanac validate` command.
