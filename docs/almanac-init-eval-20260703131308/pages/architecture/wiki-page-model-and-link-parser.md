---
title: Wiki Page Model And Link Parser
topics: [architecture, wiki]
sources:
  - id: documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
  - id: links
    type: file
    path: src/codealmanac/services/wiki/wikilinks.py
  - id: paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
---

# Wiki Page Model And Link Parser

The wiki page model is built from Markdown files under `pages/`. The loader parses frontmatter, derives the slug from `page_id` or filename stem, falls back to the first H1 for title, hashes raw content, records page mtime, normalizes topics, gathers frontmatter/source file refs, and extracts wikilinks from Markdown text tokens [@documents].

Frontmatter parsing is tolerant: invalid YAML or invalid fields make the whole raw file body content instead of crashing reads [@frontmatter]. Link extraction uses Markdown token streams so inline code and fenced code stay source text [@links].

Path references are normalized to forward slashes, no leading `./`, no absolute slash, no `..`, lowercase for comparisons, and trailing slash only for directories [@paths]. Exact formats are in [[wiki-file-format-reference]] and [[wikilink-syntax-reference]].
