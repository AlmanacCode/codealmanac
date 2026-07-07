---
title: Markdown Links And Sources
topics: [decisions, page-format]
sources:
  - id: kernel
    type: file
    path: src/codealmanac/prompts/base/kernel.md
    note: Runtime writer guidance for Markdown links, sources, citations, and retired syntaxes.
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
    note: Parser for supported frontmatter fields and structured source entries.
  - id: links
    type: file
    path: src/codealmanac/services/wiki/links.py
    note: Markdown link extraction and page-link resolution rules.
  - id: sources_plan
    type: file
    path: docs/plans/2026-07-06-sources-canonical.md
    note: Plan that removed legacy file-list frontmatter and made sources canonical for file-aware retrieval.
---

# Markdown Links And Sources

CodeAlmanac uses normal Markdown links for page links and structured `sources:` entries for evidence. It does not use double-bracket links, a separate page-storage folder, retired file-list frontmatter, or frontmatter as page identity [@kernel].

This decision separates navigation from evidence. A page link points a reader to another wiki page. A `sources:` entry tells the index and future maintainers which file, web page, commit, PR, issue, conversation, wiki page, or manual supports a claim [@frontmatter]. File evidence belongs in `sources:` with `type: file`, not in inline page links [@kernel].

## Context

The Python reset replaced older wiki syntax with a simpler authored format. The base writer prompt tells agents to use Markdown links such as `[Viewer](../viewer)`, link only to existing or newly created pages, cite non-obvious claims with inline source markers, and store file/folder evidence in `sources:` [@kernel].

The sources canonical plan made structured `sources:` the only authored evidence model for file-aware retrieval. It removed legacy file-list parsing and kept file references derived from `sources[type=file]` [@sources_plan]. That means evidence is no longer split between old frontmatter fields and current source records.

## Decision

Page-to-page navigation is authored as normal Markdown. The link extractor parses CommonMark inline links and resolves relative, extensionless page paths into page slugs while ignoring absolute URLs, query links, slash-rooted paths, file-suffixed paths, and paths with spaces [@links].

Evidence is authored in `sources:`. The frontmatter parser accepts `title`, `summary`, `topics`, and `sources`, and each source is parsed into a typed source with a source id, type, target, title, retrieval date, and note when present [@frontmatter]. Supported source types include file, web, commit, PR, issue, conversation, wiki, and manual [@frontmatter].

## Consequences

The page format is easier to read in Git and in a normal editor. Markdown links remain visible prose links, while evidence stays in a structured block that the index can project into source and file-reference tables [@frontmatter].

The decision also gives [Links and routes](../reference/page-format/links-and-routes), [Frontmatter and sources](../reference/page-format/frontmatter-and-sources), and [Path normalization and file refs](../architecture/wiki/path-normalization-and-file-refs) one contract to document. They do not need to support both wikilinks and Markdown links, or both legacy file lists and structured sources.

The cost is that writers must be precise. A file path used as evidence should be a `sources:` item, and a page link should be a Markdown link to a real or planned wiki page. Mixing those roles weakens search, health checks, and future maintenance [@kernel][@sources_plan].
