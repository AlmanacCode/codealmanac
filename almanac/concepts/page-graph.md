---
title: Page Graph
topics: [concepts, wiki]
sources:
  - id: index_schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: Derived index schema for pages, topics, links, sources, file refs, and FTS.
  - id: wiki_links
    type: file
    path: src/codealmanac/services/wiki/links.py
    note: Markdown link extraction and relative page-link resolution.
  - id: wiki_documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: Page document loading and current cross-wiki link projection behavior.
  - id: health_views
    type: file
    path: src/codealmanac/services/index/health_views.py
    note: Health report assembly over graph and source-health views.
  - id: health_graph
    type: file
    path: src/codealmanac/services/index/health_graph_views.py
    note: Graph health queries for orphan pages, broken links, dead refs, empty topics, and empty pages.
  - id: health_sources
    type: file
    path: src/codealmanac/services/index/health_source_views.py
    note: Source-citation health checks for missing, unused, and duplicate sources.
---

# Page Graph

The page graph is the derived model CodeAlmanac builds from the committed `almanac/` tree. It treats pages, topics, local page links, file references, sources, backlinks, and health checks as one connected wiki structure. The graph is stored in a local index, not authored by hand [@index_schema] [@wiki_links].

This concept matters because CodeAlmanac is more than a folder of Markdown files. Search, mentions, topics, validation, and future maintenance all depend on the index knowing how pages connect to each other and to source evidence. A page with no topics, a dead file reference, or a broken Markdown link is a graph problem, not just a prose problem [@health_views].

## Parts Of The Graph

The index has tables for `pages`, `topics`, `page_topics`, `topic_parents`, `file_refs`, `page_sources`, `page_links`, `cross_wiki_links`, and a heading-based `page_sections`/`fts_sections` pair that backs search [@index_schema]. The current document loader fills local `page_links` from Markdown links and leaves `cross_wiki_links` empty [@wiki_documents]. These tables separate authored material from derived lookup state. The Markdown file remains the source; the index is the read model. See [Index refresh and search](../architecture/wiki/index-refresh-and-search) for how the section tables are built and queried.

Topics group pages across folders. Topic parent rows form a directed topic structure, while page-topic rows attach individual pages to the subjects they explain [@index_schema]. This is the base for [Topics DAG](../architecture/wiki/topics-dag) and [topics.yaml](../reference/topics-yaml).

Page links come from normal Markdown links. The link extractor parses CommonMark inline links, ignores absolute URLs and file-suffixed paths, and resolves relative extensionless links against the source page's route [@wiki_links]. This makes page links part of the same graph as topics and sources.

File references come from structured page sources. The index stores the normalized path, original path, and whether the reference is a directory [@index_schema]. That lets mention search and health checks reason about source files without treating file paths as wiki links.

## Health As Graph Inspection

Health checks are graph inspection, not a separate mechanism: they query the same tables described above for structural problems, such as pages with no topic rows or links whose targets are missing, plus a source-citation view that keeps `sources:` and inline citations aligned [@health_graph] [@health_sources]. See [Health and validation](../architecture/wiki/health-and-validation) for the full enumerated check list and the validation boundary built on top of it.

## Why It Matters

The page graph gives the wiki its working memory. It lets [Health and validation](../architecture/wiki/health-and-validation) find drift, lets topic navigation stay useful, and lets future agents follow links instead of rediscovering relationships from raw files.

The graph also keeps the authored format simple. Writers use Markdown links, `topics:`, and `sources:`; CodeAlmanac derives the link table, topic table, file-reference table, and source-citation checks from those page files [@index_schema][@wiki_links].
