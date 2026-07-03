---
page_id: architecture-wiki-root-layout
title: Wiki Root Layout
summary: The initialized wiki root has a flat source shape, while page category folders live under `pages/`.
topics: [architecture, storage]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: wiki-service
    type: file
    path: src/codealmanac/services/wiki/service.py
  - id: index-sources
    type: file
    path: src/codealmanac/services/index/sources.py
---

# Wiki Root Layout

The initialized root is flat: `README.md`, `topics.yaml`, `pages/`, and `manual/` are peers. Runtime artifacts such as `index.db` and `jobs/` may also appear under the same root, but they are derived local state rather than wiki source. [@manual] [@wiki-service]

## Where do category folders go?

Category folders such as `concepts/`, `architecture/`, `guides/`, `decisions/`, and `reference/` belong under `pages/`. The index loader recursively scans markdown files under `pages/`, so nested page folders are supported without changing the root contract. [@index-sources]

## What does init create?

`WikiService.initialize()` creates the root, `pages/`, `manual/`, starter README, starter topics, starter page, bundled manual files, and root `.gitignore` entries for runtime state. [@wiki-service]

## What reference page has the exact layout?

See `[[reference-root-layout]]`.

