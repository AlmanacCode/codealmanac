---
page_id: wiki-manual
title: Wiki Manual
topics: [concepts]
sources:
  - id: prompt-purpose
    type: file
    path: prompts/base/purpose.md
    note: Defines the human-readable codebase wiki purpose.
  - id: prompt-notability
    type: file
    path: prompts/base/notability.md
    note: Defines page selection and folder placement rules.
  - id: prompt-syntax
    type: file
    path: prompts/base/syntax.md
    note: Defines page syntax, sources, citations, links, and source-control hygiene.
  - id: general-manual
    type: manual
    note: General Almanac manual discussion in ../almanac supplied the article-quality and primary-tree principles adapted here for codebases.
---

# Wiki Manual

This manual defines how the CodeAlmanac wiki is written and maintained. It
exists because `docs/almanac/` must be readable documentation for people and
queryable context for agents. [@prompt-purpose]

The rule is simple: write durable articles, not agent scratch notes. A good
page gives one subject a stable home, cites its evidence, links to related
subjects, and helps a new maintainer understand the repo faster. [@general-manual]

## Manual Pages

- `page-selection.md` explains what becomes a page, section, list, or active note.
- `writing-standard.md` explains leads, citations, history, links, and prose quality.
- `maintenance.md` explains how Build, Absorb, and Garden should evolve the wiki.
- `_meta/wiki-conventions.md` records local conventions and migration state.

## Non-Negotiables

- Canonical readable content lives in `docs/almanac/`.
- `.almanac/` is runtime state and legacy compatibility.
- `README.md` is the front door.
- `page_id` is the stable identity for links and search.
- `sources:` and citations make claims auditable.
- Old knowledge stays when it explains the present.
- `active/` is temporary; durable knowledge eventually moves elsewhere.
