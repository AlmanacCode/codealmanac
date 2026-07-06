---
title: Indexing
summary: The SQLite index is a derived read model over the Markdown wiki tree.
topics: [architecture, storage, wiki-design]
sources:
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: SQLite schema and index database connection.
  - id: runtime
    type: file
    path: src/codealmanac/settings.py
    note: LocalStatePaths maps repositories to derived runtime directories.
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
  - id: validation
    type: file
    path: src/codealmanac/services/health/service.py
    note: Validate command service boundary.
---

# Indexing

The index is derived runtime state. `LocalStatePaths.repository_dir(repository_id)` maps each registered repository to `~/.codealmanac/repos/<repository-id>/`, and `src/codealmanac/services/index/schema.py` stores `index.db` inside that runtime directory [@runtime] [@schema].

The schema includes pages, topics, page-topic edges, topic-parent edges, file references, page sources, page links, cross-wiki links, FTS5 content, and index metadata [@schema]. The projection deletes and rebuilds those tables from loaded page documents and topic definitions [@projection].

Page documents load title, summary, topics, sources, file references, page links, and body from Markdown files [@documents]. File references come from `sources:` file entries. Page links come from ordinary Markdown links whose href resolves to another page id.

Health views read the derived tables to report graph and source problems [@health]. `HealthService.validate` combines index refresh, health findings, raw `sources:` shape checks, and runtime-state leak checks for the public `codealmanac validate` command [@validation].
