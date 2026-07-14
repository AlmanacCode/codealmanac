---
title: No Page-Kind Field
topics: [decisions, wiki, page-format, product]
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

# No Page-Kind Field

CodeAlmanac does not parse or validate a `kind` frontmatter field for concept,
architecture, guide, decision, and reference pages. The manual gives each page
type separate writing guidance, but that guidance is authoring convention, not
a runtime contract [@manual-overview] [@frontmatter-parser]. This decision
records why the field is absent and the conditions that would justify adding
it, so a future contributor does not add `kind:` to pages as a casual
convention before the parser, validation, prompts, and viewer are ready to use
it.

## Status

Accepted (deferred). No `kind` field exists today. Revisit only when a concrete
reader workflow needs kind-specific behavior.

## Context

The current parser models `title`, `summary`, `topics`, and `sources`;
`FrontmatterFields` ignores extra keys instead of storing them on
`ParsedFrontmatter` [@frontmatter-parser] [@page-models]. The maintained
[Frontmatter and sources](../reference/page-format/frontmatter-and-sources)
reference documents the same contract and does not list `kind` as a supported
field [@frontmatter-reference].

Page type is currently expressed only through folder placement
(`concepts/`, `architecture/`, `guides/`, `decisions/`, `reference/`) and the
matching manual page. That is enough for a human or agent writer to follow the
right shape, but it is not machine-checked.

## Decision

CodeAlmanac does not add a `kind` field until it would change behavior, not
just record a label. Adding page kinds would require parser, validation,
prompt, and viewer changes together; it should not happen as a hidden docs
convention or by casually adding `kind:` to individual pages
[@frontmatter-parser] [@frontmatter-reference].

Good reasons to revisit this decision include kind-specific validation,
filtered viewer modes, better prompt instructions, or export profiles that
assemble atomic pages into human-readable packets. Without one of those
behaviors, the current folder, manual, and topic system is simpler because it
does not add another metadata field to keep current [@manual-overview]
[@frontmatter-reference].

## Consequences

Folder placement and topic tagging remain the only durable signals of page
role; a page's `kind` cannot be queried, filtered, or validated independent of
its path today.

Viewer or export profiles are the safest adjacent idea if this decision is
revisited. Pages can stay atomic for agents while a viewer or export command
presents larger guides, onboarding paths, or debug views. That belongs at the
projection boundary rather than inside committed prose until a concrete reader
workflow requires it [@frontmatter-reference].
