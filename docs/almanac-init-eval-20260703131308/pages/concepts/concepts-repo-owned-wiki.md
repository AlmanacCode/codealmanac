---
title: Repo-Owned Wiki
topics: [concepts, wiki]
sources:
  - id: readme
    type: file
    path: README.md
  - id: manual
    type: file
    path: MANUAL.md
  - id: wiki-service
    type: file
    path: src/codealmanac/services/wiki/service.py
  - id: root-readme
    type: file
    path: eval-almanac/README.md
---

# Repo-Owned Wiki

A repo-owned wiki is CodeAlmanac's committed knowledge layer for a codebase. It is Markdown under the configured Almanac root, backed by a local SQLite index for fast reads, and it stores decisions, flows, invariants, incidents, gotchas, and durable project context that source code alone does not explain [@readme].

The wiki source is part of the repository, not hosted state. `codealmanac init` creates `README.md`, `topics.yaml`, `pages/`, and `manual/` under the chosen root; runtime files such as `index.db` and jobs are derived local state [@readme]. [[concepts-configured-almanac-root]] explains root selection.

The notability bar is practical: write pages when they preserve non-obvious knowledge that helps a future agent work safely [@root-readme]. The page format is defined by [[wiki-file-format-reference]], and the parser/index behavior is covered in [[wiki-page-model-and-link-parser]].
