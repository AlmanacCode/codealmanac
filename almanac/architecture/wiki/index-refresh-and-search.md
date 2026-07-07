---
title: Index Refresh And Search
topics: [architecture, wiki, search, index]
sources:
  - id: index-service
    type: file
    path: src/codealmanac/services/index/service.py
    note: Index service entrypoints, implicit refresh, reindex, and runtime path selection.
  - id: index-store
    type: file
    path: src/codealmanac/services/index/store.py
    note: Refresh, rebuild, page lookup, topic lookup, search, counts, and health report calls.
  - id: index-sources
    type: file
    path: src/codealmanac/services/index/sources.py
    note: Loading page documents, topics, source signatures, and route-collision checks.
  - id: index-projection
    type: file
    path: src/codealmanac/services/index/projection.py
    note: Replacing derived tables and storing source signatures.
  - id: index-schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: Derived SQLite schema, FTS5 table, and per-repository index path.
  - id: search-views
    type: file
    path: src/codealmanac/services/index/search_views.py
    note: FTS query building, topic filters, mention filters, and result ordering.
  - id: search-service
    type: file
    path: src/codealmanac/services/search/service.py
    note: Search service selection and request handoff to the index.
  - id: repo-readme
    type: file
    path: README.md
    note: Public read commands and runtime state description.
---

# Index Refresh And Search

Index refresh and search are the read side of the local repo wiki. Markdown under `almanac/` is the source of truth, but query commands read from a derived SQLite index stored under the selected repository's local runtime directory [@repo-readme] [@index-service]. The index is refreshed implicitly before read operations, so users can edit Markdown and then run `search`, `show`, `topics`, or `health` without a separate rebuild step [@index-service].

The derived index exists to make the wiki fast and queryable without making database files part of the committed wiki. It stores pages, topics, source entries, file references, page links, and an FTS5 table for text search [@index-schema] [@index-projection].

## Refresh Owner

`IndexService` owns the read-model workflow. It receives a `RepositoriesService`, an `IndexStore`, and `LocalStatePaths`; for each repository it computes the runtime directory with `local_state.repository_dir(repository.repository_id)` [@index-service]. That keeps the derived `index.db` in `~/.codealmanac/repos/<repo-id>/`, not in the repo's `almanac/` tree [@index-service] [@index-schema].

Read entrypoints call `refresh(...)` before returning data. `summary(...)`, `search(...)`, `get_page(...)`, `list_topics(...)`, `get_topic(...)`, and `health_report(...)` all refresh the selected repository before querying the store [@index-service]. `reindex(...)` is the explicit rebuild path; it selects the repository for a read command and calls `IndexStore.rebuild(...)` [@index-service] [@index-store].

## Freshness Signature

Refresh is driven by a source signature. `load_index_sources(...)` loads page documents, topics, and file counts, then creates a signature from each document's slug, relative path, content hash, the hash of `topics.yaml`, `files_seen`, and `files_skipped` [@index-sources]. The store compares that signature with the value saved in `index_metadata` [@index-store] [@index-projection].

If the stored signature matches, refresh reports no changed pages and leaves the index intact [@index-store]. If the signature differs, `replace_documents(...)` clears the derived tables and writes the current documents, topics, file references, page sources, page links, and FTS rows in one replacement pass [@index-store] [@index-projection]. A forced reindex skips the equality check and rebuilds from the current sources [@index-store].

## Search Query Shape

Search goes through `SearchService.search(...)`, which first selects the target repository for a read command and then calls `IndexService.search(...)` with query text, topics, mentions, and limit [@search-service]. The index service refreshes the repository before calling the store's search view [@index-service].

When query text is present, `search_sql(...)` joins `pages` to `fts_pages`, builds a prefix `AND` FTS query from casefolded alphanumeric tokens, and orders results by FTS rank, newest `updated_at`, and slug [@search-views]. Topic filters use `EXISTS` checks against `page_topics`, with requested topic names normalized to kebab-case [@search-views]. Without query text, results are ordered by newest `updated_at` and slug [@search-views].

File mention search uses the indexed `file_refs` table. It supports exact file references, directory references that cover child files, and folder queries that match references under that folder [@search-views]. The details of path normalization and `GLOB` escaping live in [Path normalization and file refs](path-normalization-and-file-refs).

## Derived Store Boundary

The index schema is intentionally a read model. `pages` stores the route, title, summary, file path, content hash, mtime, and body; `fts_pages` stores searchable text; relationship tables store topics, sources, page links, cross-wiki links, and file references [@index-schema]. `replace_documents(...)` rebuilds those tables from loaded Markdown and `topics.yaml` rather than treating them as authored state [@index-projection].

That boundary is why read commands can refresh silently. The database can be dropped or rebuilt from the committed wiki source. For the persistence pattern behind these stores, see [SQLite store boundaries](../persistence/sqlite-store-boundaries). For the public commands that exercise this surface, see [CLI public command surface](../../reference/cli/public-command-surface).
