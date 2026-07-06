---
title: Source Provenance
summary: Authored evidence belongs in sources entries.
topics: [decisions, wiki-design, storage]
sources:
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
    note: Frontmatter parser and source target fields.
  - id: documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: Page document loading and source-derived file refs.
  - id: manual
    type: file
    path: src/codealmanac/manual/sources.md
    note: User-facing source guidance.
  - id: ticket
    type: file
    path: implementation-tickets.md
    note: Ticket 3 source model decision.
---

# Source Provenance

`sources:` entries are the product evidence model for pages [@manual] [@ticket]. The parser accepts source types for files, web pages, commits, pull requests, issues, conversations, wiki pages, and manual pages [@frontmatter].

For file sources, the type-specific field is `path`; for web sources it is `url`; for commits it can be `commit`, `sha`, or `ref` [@frontmatter]. The parser stores a normalized `PageSource` value with id, type, target, title, retrieved timestamp, and note [@frontmatter].

Page loading turns file sources into file references for mention search [@documents]. Legacy file-list frontmatter is not a product input after Ticket 3 [@documents] [@ticket].
