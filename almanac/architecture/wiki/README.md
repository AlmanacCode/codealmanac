---
title: Wiki Architecture
topics: [architecture, wiki, overview]
sources:
  - id: page-identity
    type: file
    path: almanac/architecture/wiki/page-identity.md
    note: Architecture page for path-based page identity and Markdown route resolution.
  - id: path-refs
    type: file
    path: almanac/architecture/wiki/path-normalization-and-file-refs.md
    note: Architecture page for source-backed file references and mention search path matching.
  - id: index-search
    type: file
    path: almanac/architecture/wiki/index-refresh-and-search.md
    note: Architecture page for the derived read index and search behavior.
  - id: topics-dag
    type: file
    path: almanac/architecture/wiki/topics-dag.md
    note: Architecture page for topic graph reads, mutations, and cycle prevention.
  - id: health-validation
    type: file
    path: almanac/architecture/wiki/health-and-validation.md
    note: Architecture page for health reports and validation gates.
  - id: topics-file
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for wiki, pages, sources, search, index, health, and topics.
  - id: page-graph
    type: wiki
    path: concepts/page-graph
    note: Concept page for pages, topics, links, backlinks, sources, and health as one wiki graph.
---

# Wiki Architecture

Wiki architecture is the part of CodeAlmanac that turns the committed `almanac/` tree into a navigable local knowledge base. The pages in this folder explain how Markdown paths become page identity, how file evidence becomes searchable references, how the derived index powers read commands, how topics form a DAG, and how health and validation keep the graph trustworthy [@page-identity] [@path-refs] [@index-search] [@topics-dag] [@health-validation].

Read this hub when changing page parsing, page links, source metadata, search, topic mutation, validation, or any feature that depends on the wiki graph. The topic graph treats `wiki` as an architecture neighborhood with child topics for page format, pages, health, search, index, and topics [@topics-file].

## Reading Order

Start with [Page identity](page-identity). It explains the path-based route contract: ordinary Markdown files use their path under `almanac/`, and `README.md` files become folder landing pages [@page-identity].

Then read [Path normalization and file refs](path-normalization-and-file-refs) when the change touches `sources:` entries, file evidence, or `codealmanac search --mentions`. That page owns the normalization and escaped `GLOB` behavior that keeps path matching precise [@path-refs].

Use [Index refresh and search](index-refresh-and-search) for read commands. It explains the derived SQLite index, implicit refresh before `search`, `show`, `topics`, and `health`, FTS query shape, topic filtering, and mention search [@index-search].

Use [Topics DAG](topics-dag) for topic browsing or mutation commands. It explains index-backed topic reads, deterministic `topics.yaml` edits, page frontmatter rewrites, and cycle prevention [@topics-dag].

Finish with [Health and validation](health-and-validation) when changing graph checks or lifecycle quality gates. It explains how `health` reports indexed problems and how `validate` turns source-shape, runtime-state, and graph checks into a pass/fail boundary [@health-validation].

## Neighboring Contracts

The exact authored page format lives in [Frontmatter and sources](../../reference/page-format/frontmatter-and-sources) and [Links and routes](../../reference/page-format/links-and-routes). The broader concept is [Local repo wiki](../../concepts/local-repo-wiki), which explains why committed Markdown is the durable source while runtime databases are rebuildable local state.

[Page graph](../../concepts/page-graph) is the concept page for the same neighborhood. It explains how pages, Markdown links, topics, backlinks, `sources:`, file references, and health checks form one graph rather than separate bookkeeping systems [@page-graph].
