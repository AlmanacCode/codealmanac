---
page_id: reference-page-frontmatter
title: Page Frontmatter
summary: This page lists the frontmatter fields parsed from wiki markdown pages.
topics: [reference]
sources:
  - id: wiki-models
    type: file
    path: src/codealmanac/services/wiki/models.py
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
---

# Page Frontmatter

Page frontmatter is parsed into known fields and then used to build indexed page documents. Unknown fields are ignored by the parser. [@frontmatter]

## Fields

| Field | Type | Meaning |
|---|---|---|
| `page_id` | text | Optional explicit slug source. |
| `title` | text | Optional display title. |
| `summary` | text | Optional short page summary. |
| `topics` | list of text | Topic slugs for the page. |
| `files` | list of text | Legacy file or folder references. |
| `sources` | list of source objects | Structured evidence sources. |

These fields are defined by `ParsedFrontmatter` and `FrontmatterFields`. [@wiki-models] [@frontmatter]

## Related pages

Use `[[reference-source-schema]]` for source objects and `[[architecture-page-model]]` for how frontmatter becomes an indexed page.

