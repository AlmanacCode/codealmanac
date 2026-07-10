---
title: Future Page Kinds
topics: [concepts, wiki, page-format, product]
sources:
  - id: frontmatter-parser
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
    note: Current parsed frontmatter fields and extra-key behavior.
  - id: page-models
    type: file
    path: src/codealmanac/services/wiki/models.py
    note: Parsed frontmatter and page document models.
  - id: frontmatter-reference
    type: wiki
    path: reference/page-format/frontmatter-and-sources
    note: Maintained reference for supported frontmatter and sources.
  - id: manual-overview
    type: file
    path: src/codealmanac/manual/README.md
    note: Manual overview listing the page-specific writing manuals.
---

# Future Page Kinds

Future page kinds are a possible content contract for CodeAlmanac pages, not current runtime behavior. The current parser models `title`, `summary`, `topics`, and `sources`; it does not model a `kind` field today [@frontmatter-parser] [@page-models]. This means concept, guide, decision, and reference vocabulary can guide writing, but it is not page identity or validated metadata.

The useful distinction is the reader question each page answers. The manual has separate writing guidance for concept, architecture, guide, decision, reference, source, ingest, and garden pages, but those manuals are authoring guidance rather than a parsed `kind` contract [@manual-overview] [@frontmatter-parser].

## Current Contract

The modeled frontmatter fields are `title`, `summary`, `topics`, and `sources`; `FrontmatterFields` ignores extra keys instead of storing them on `ParsedFrontmatter` [@frontmatter-parser] [@page-models]. The maintained [Frontmatter and sources](../reference/page-format/frontmatter-and-sources) reference documents the same contract and does not list `kind` as a supported field [@frontmatter-reference].

That boundary matters for future work. Adding page kinds would require parser, validation, prompt, and viewer changes; it should not happen as a hidden docs convention or by casually adding `kind:` to pages [@frontmatter-parser] [@frontmatter-reference].

## Product Fit

Page kinds become worthwhile only if they change behavior. Good reasons include kind-specific validation, filtered viewer modes, better prompt instructions, or export profiles that assemble atomic pages into human-readable packets. Without one of those behaviors, the current folder, manual, and topic system is simpler because it does not add another metadata field to keep current [@manual-overview] [@frontmatter-reference].

Viewer or export profiles are the safest adjacent idea. Pages can stay atomic for agents while a viewer or export command presents larger guides, onboarding paths, or debug views. That belongs at the projection boundary rather than inside committed prose until a concrete reader workflow requires it [@frontmatter-reference].
