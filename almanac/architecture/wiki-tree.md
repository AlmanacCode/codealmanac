---
title: Wiki Tree
summary: The committed wiki source is a nested Markdown tree under almanac/.
topics: [architecture, wiki-design, storage]
sources:
  - id: paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
    note: Page discovery, reserved directories, reference normalization, and page-id mapping.
  - id: sources
    type: file
    path: src/codealmanac/services/index/sources.py
    note: Index-source loader and route-collision detection.
  - id: roots
    type: file
    path: src/codealmanac/services/repositories/roots.py
    note: Almanac root normalization and initialized-root detection.
  - id: templates
    type: file
    path: src/codealmanac/services/wiki/templates.py
    note: Init-time starter wiki templates.
  - id: kernel
    type: file
    path: src/codealmanac/prompts/base/kernel.md
    note: Agent-facing syntax rules for authored pages.
---

# Wiki Tree

The only supported repo wiki root is `almanac/`; root normalization rejects any value other than that repo-relative path [@roots]. A root counts as initialized when it contains both `topics.yaml` and `README.md` [@roots].

Every Markdown file under `almanac/` is a page unless it is under a reserved source directory such as `manual` or `jobs` [@paths]. `almanac/README.md` maps to page id `README`, `almanac/architecture/README.md` maps to `architecture`, and `almanac/architecture/indexing.md` maps to `architecture/indexing` [@paths].

Route collisions fail during source loading. For example, `almanac/architecture.md` and `almanac/architecture/README.md` both map to `architecture`, so the loader raises a validation error instead of choosing one page [@sources].

`codealmanac init` writes starter `README.md` and `topics.yaml` files, then starts the build run that creates the first real wiki pages [@templates]. The prompt kernel tells agents to write normal Markdown pages in the source tree and to identify pages by their path under `almanac/` [@kernel].
