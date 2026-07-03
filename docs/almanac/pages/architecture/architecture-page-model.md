---
page_id: architecture-page-model
title: Page Model
summary: The page model converts markdown files into indexed documents with slugs, topics, sources, file references, links, and body text.
topics: [architecture]
sources:
  - id: wiki-models
    type: file
    path: src/codealmanac/services/wiki/models.py
  - id: wiki-documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
---

# Page Model

The page model is the bridge between committed markdown and the read model. A markdown file becomes a `PageDocument` with a slug, title, summary, file path, content hash, updated timestamp, topics, sources, file references, page links, cross-wiki links, and body text. [@wiki-models] [@wiki-documents]

## How is metadata read?

Frontmatter parsing accepts known fields and ignores unknown fields. Invalid frontmatter falls back to treating the whole file as body text. [@frontmatter]

## How are links and references found?

The loader starts with legacy `files:` references and structured file sources, then adds references and links extracted from `[[...]]` syntax in the body. [@wiki-documents]

## Why does this page matter?

`[[architecture-index-read-model]]`, `[[reference-page-frontmatter]]`, and `[[reference-wikilink-syntax]]` all depend on this model.

