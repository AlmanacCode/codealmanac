---
title: Wiki File Format Reference
topics: [reference, wiki]
sources:
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
  - id: documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
  - id: manual
    type: file
    path: eval-almanac/manual/how-to-write.md
---

# Wiki File Format Reference

This page defines the Markdown page fields parsed by CodeAlmanac. [[wiki-page-model-and-link-parser]] explains how these fields enter the read model.

## Frontmatter Fields

- `page_id`: optional slug source; if absent, filename stem is used [@documents].
- `title`: optional page title; if absent, first H1 or filename stem is used [@documents].
- `summary`: optional summary stored in the index [@frontmatter].
- `topics`: list of topic names or slugs, normalized to kebab-case [@documents].
- `files`: list of file or folder references used for mentions search [@frontmatter].
- `sources`: list of structured source entries used for provenance and citation health [@frontmatter].

## Source Entry Fields

Every parsed source needs `id` and `type`. Supported types are `file`, `web`, `commit`, `pr`, `issue`, `conversation`, `wiki`, and `manual` [@frontmatter].

Type-specific target fields are accepted before generic `target`: `path` for file, `url` for web, `commit`/`sha`/`ref` for commit, `pr`/`number`/`url` for PR, `issue`/`number`/`url` for issue, `path`/`run_id`/`session_id` for conversation, `page`/`slug`/`path` for wiki, and `path`/`page`/`title` for manual [@frontmatter].

The writing manual requires strong leads, direct prose, and inline citations for non-obvious claims [@manual]. Citation/source health is stored by [[sqlite-index-read-model]].
