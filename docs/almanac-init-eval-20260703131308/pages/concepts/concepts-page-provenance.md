---
title: Page Provenance
topics: [concepts, wiki, index]
sources:
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Page Provenance

Page provenance is the structured `sources:` metadata and inline citation practice that lets a future agent verify wiki claims. The page parser accepts source entries with an `id`, `type`, and type-specific target fields such as `path`, `url`, `commit`, `pr`, `issue`, `page`, or fallback `target` [@frontmatter].

The index projects page sources into the `page_sources` table and also derives file references from file-type sources [@schema]. Health checks can then reason about missing citations, unused sources, duplicate sources, and dead file references.

Use [[wiki-file-format-reference]] for exact fields and [[index-schema-reference]] for the stored projection.
