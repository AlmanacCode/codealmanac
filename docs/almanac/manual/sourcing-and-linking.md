---
page_id: manual-sourcing-and-linking
title: Sourcing And Linking
summary: How this wiki uses inline citations and wikilinks.
topics: [manual]
sources:
  - id: structure-plan
    type: file
    path: docs/plans/opinionated-wiki-structure.md
  - id: page-model
    type: file
    path: src/codealmanac/services/wiki/models.py
  - id: wiki-documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
---

# Sourcing And Linking

Pages in this wiki must cite the code or document that supports factual claims and must link related pages with `[[...]]`. The source list lives in frontmatter, citation markers such as `[@wiki-documents]` appear inline, and wikilinks are indexed as page links, file links, folder links, or cross-wiki links by the page parser. [@structure-plan] [@page-model] [@wiki-documents]

## What needs a citation?

Architecture claims cite source files, tests, or constraint documents. Decision claims cite the decision source. Guide steps cite implementation files when behavior matters. Reference facts cite the parser, model, schema, or service that defines them.

## What should be linked?

Link the noun the reader may want to follow next. A page about `[[architecture-page-run-workflow]]` should link to `[[concept-lifecycle-run]]`, `[[reference-run-records]]`, and decisions such as `[[decision-page-run-owns-lifecycle-writes]]`.

## What should not be linked?

Do not link every repeated word. Link stable concepts, subsystems, decisions, guides, and reference pages. If a page has no incoming or outgoing links, treat that as a design smell.

