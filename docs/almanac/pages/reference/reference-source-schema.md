---
page_id: reference-source-schema
title: Source Schema
summary: This page lists the structured source types accepted in page frontmatter.
topics: [reference]
sources:
  - id: wiki-models
    type: file
    path: src/codealmanac/services/wiki/models.py
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
---

# Source Schema

Structured page sources describe the evidence behind a page. A source has an id, type, optional target, optional title, optional retrieved timestamp, and optional note. [@wiki-models]

## Source types

| Type | Typical target fields |
|---|---|
| `file` | `path` |
| `web` | `url` |
| `commit` | `commit`, `sha`, `ref` |
| `pr` | `pr`, `number`, `url` |
| `issue` | `issue`, `number`, `url` |
| `conversation` | `path`, `run_id`, `session_id` |
| `wiki` | `page`, `slug`, `path` |
| `manual` | `path`, `page`, `title` |

The parser also accepts a generic `target` field after type-specific fields. [@frontmatter]

## Related pages

Read `[[reference-page-frontmatter]]` for the surrounding frontmatter fields, and read the manual page `manual/sourcing-and-linking.md` for how to use sources in prose.
