---
page_id: concept-page
title: Page
summary: A page is a markdown document under `pages/` with frontmatter, body text, source citations, and indexed links.
topics: [concepts]
sources:
  - id: wiki-models
    type: file
    path: src/codealmanac/services/wiki/models.py
  - id: wiki-documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
---

# Page

A page is a markdown file under `<almanac-root>/pages/` that becomes a `PageDocument` in the index. The parser reads frontmatter, derives a slug from `page_id` or the filename, extracts topics, sources, file references, page links, cross-wiki links, and body text. [@wiki-models] [@wiki-documents]

## What identifies a page?

The canonical slug comes from `page_id` when present, otherwise from the filename stem. The value is normalized to kebab case. [@wiki-documents]

## What belongs in frontmatter?

Frontmatter can include `page_id`, `title`, `summary`, `topics`, `files`, and structured `sources`. Source entries can describe files, web pages, commits, PRs, issues, conversations, wiki pages, or manual pages. [@wiki-models]

## How does a page connect to the graph?

The body uses `[[...]]` links. The parser classifies each link as a page, file, folder, or cross-wiki reference. See `[[reference-wikilink-syntax]]`.

