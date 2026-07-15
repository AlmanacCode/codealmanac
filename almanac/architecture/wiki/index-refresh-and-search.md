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
  - id: wiki-sections
    type: file
    path: src/codealmanac/services/wiki/sections.py
    note: Heading-based Markdown section projection used to build search sections.
  - id: index-query
    type: file
    path: src/codealmanac/services/index/query.py
    note: Search query analysis that produces an OR-joined, prefix-matching FTS5 expression.
  - id: slice-141-plan
    type: file
    path: docs/plans/slice-141-section-search.md
    note: Implementation plan for section-level BM25 search, ranking, and collapse rules.
  - id: repo-readme
    type: file
    path: README.md
    note: Public read commands and runtime state description.
---

# Index Refresh And Search

Index refresh and search are the read side of the local repo wiki. Markdown under `almanac/` is the source of truth, but query commands read from a derived SQLite index stored under the selected repository's local runtime directory [@repo-readme] [@index-service]. The index is refreshed implicitly before read operations, so users can edit Markdown and then run `search`, `show`, `topics`, or `health` without a separate rebuild step [@index-service].

The derived index exists to make the wiki fast and queryable without making database files part of the committed wiki. It stores pages, topics, source entries, file references, page links, Markdown-derived sections, and a section-level FTS5 table for text search [@index-schema] [@index-projection].

## Refresh Owner

`IndexService` owns the read-model workflow. It receives a `RepositoriesService`, an `IndexStore`, and `LocalStatePaths`; for each repository it computes the runtime directory with `local_state.repository_dir(repository.repository_id)` [@index-service]. That keeps the derived `index.db` in `~/.codealmanac/repos/<repo-id>/`, not in the repo's `almanac/` tree [@index-service] [@index-schema].

Read entrypoints call `refresh(...)` before returning data. `summary(...)`, `search(...)`, `get_page(...)`, `list_topics(...)`, `get_topic(...)`, and `health_report(...)` all refresh the selected repository before querying the store [@index-service]. `reindex(...)` is the explicit rebuild path; it selects the repository for a read command and calls `IndexStore.rebuild(...)` [@index-service] [@index-store].

## Freshness Signature

Refresh is driven by a source signature. `load_index_sources(...)` loads page documents, topics, and file counts, then creates a signature from each document's slug, relative path, content hash, the hash of `topics.yaml`, `files_seen`, and `files_skipped` [@index-sources]. The store compares that signature with the value saved in `index_metadata` [@index-store] [@index-projection].

If the stored signature matches, refresh reports no changed pages and leaves the index intact [@index-store]. If the signature differs, `replace_documents(...)` clears the derived tables and writes the current documents, topics, file references, page sources, page links, and FTS rows in one replacement pass [@index-store] [@index-projection]. A forced reindex skips the equality check and rebuilds from the current sources [@index-store].

## Section Projection

Search does not match whole pages directly. `project_sections(...)` parses each page's Markdown body with `markdown-it-py` and splits it into heading-based `WikiSection` rows: any text before the first heading becomes an introduction section under the page title, and each heading opens a new section that runs until the next heading at any level, carrying the ancestor heading path that produced it [@wiki-sections]. Section order is source order, and each section's `section_id` is a zero-padded ordinal, so rebuilding the same Markdown always produces the same section rows [@wiki-sections]. `replace_documents(...)` calls this projection for every page and writes one `page_sections` row and one `fts_sections` row per section, alongside the existing `pages` row [@index-projection].

This section layer is why search results can point at the specific heading that matched instead of only the page. It replaced an earlier whole-page `fts_pages` table with `page_sections` (heading path, ordinal, and section body) plus a section-scoped `fts_sections` FTS5 virtual table indexing page slug, page title, heading, and section body [@index-schema] [@slice-141-plan].

## Search Query Shape

Search goes through `SearchService.search(...)`, which first selects the target repository for a read command and then calls `IndexService.search(...)` with query text, topics, mentions, and limit [@search-service]. The index service refreshes the repository before calling the store's search view [@index-service].

Query analysis is deliberately recall-oriented rather than strict. `analyze_search_query(...)` casefolds the query, extracts Unicode word tokens, drops duplicates while keeping first-seen order, and joins the tokens with `OR` as quoted FTS5 prefix terms, so a query only needs one matching token to surface a section instead of requiring every token to match [@index-query]. This replaced an earlier strict `AND` query over whole pages, which rejected natural-language questions that used words the page didn't contain [@slice-141-plan].

When query text is present, `search_sql(...)` joins `pages` to `page_sections` and `fts_sections`, scores each matching section with weighted `bm25(...)` so title and heading matches outrank body-only matches, and keeps only the best-scoring section per page with a `ROW_NUMBER() OVER (PARTITION BY slug ...)` window before returning results [@search-views]. Final results are ordered by that section's BM25 rank, then newest `updated_at`, then slug [@search-views]. Each result carries the matched section's heading path and a bounded `snippet()` excerpt through `matched_heading` and `excerpt`, in addition to the existing page fields [@search-views]. Topic filters use `EXISTS` checks against `page_topics`, with requested topic names normalized to kebab-case [@search-views]. Without query text, `matched_heading` and `excerpt` are absent and results are ordered by newest `updated_at` and slug, the same as before section-level search [@search-views].

File mention search uses the indexed `file_refs` table. It supports exact file references, directory references that cover child files, and folder queries that match references under that folder [@search-views]. The details of path normalization and `GLOB` escaping live in [Path normalization and file refs](path-normalization-and-file-refs).

## Derived Store Boundary

The index schema is intentionally a read model. `pages` stores the route, title, summary, file path, content hash, mtime, and body; `page_sections` and `fts_sections` store the section projection used for search; relationship tables store topics, sources, page links, cross-wiki links, and file references [@index-schema]. `replace_documents(...)` rebuilds those tables from loaded Markdown and `topics.yaml` rather than treating them as authored state [@index-projection].

That boundary is why read commands can refresh silently. The database can be dropped or rebuilt from the committed wiki source. For the persistence pattern behind these stores, see [SQLite store boundaries](../persistence/sqlite-store-boundaries). For the public commands that exercise this surface, see [CLI public command surface](../../reference/cli/public-command-surface).
