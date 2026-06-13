---
page_id: codealmanac-wiki
title: CodeAlmanac Wiki
topics: [concepts, architecture]
sources:
  - id: legacy-readme
    type: file
    path: .almanac/README.md
    note: Defines the previous flat wiki purpose, notability bar, topic taxonomy, and writing conventions.
  - id: docs-layout-plan
    type: file
    path: docs/plans/2026-06-13-docs-almanac-layout.md
    note: Records the migration scope and the decision to make docs/almanac the canonical readable wiki.
  - id: decision-log
    type: file
    path: docs/plans/2026-06-13-docs-almanac-decision-log.md
    note: Records the content-root, legacy-compatibility, page_id, and topic ownership decisions.
---

# CodeAlmanac Wiki

This is the readable Almanac wiki for CodeAlmanac, the local codebase wiki
tool. It is written for a new maintainer: a human joining the repo or an agent
starting with no prior session context. [@docs-layout-plan]

The canonical wiki lives in `docs/almanac/`. The older `.almanac/pages/` corpus
is still indexed during migration, so pages such as [[lifecycle-architecture]],
[[sqlite-indexer]], [[harness-providers]], and [[source-provenance]] remain
important source material. [@decision-log]

## Start Here

Read `_manual/README.md` before creating or moving pages. It defines the wiki's
page-selection, writing, and maintenance rules.

Use these sections as the primary browse map:

| Section | What belongs there |
| --- | --- |
| `concepts/` | Core vocabulary and mental models. |
| `architecture/` | Subsystems, runtime flows, storage, boundaries, and integration shape. |
| `guides/` | Task-oriented maintainer workflows. |
| `reference/` | Exact public contracts: commands, flags, config, formats, schemas, and APIs. |
| `decisions/` | Accepted choices and their rationale. |
| `incidents/` | Failures, migrations, regressions, and lessons that still matter. |
| `active/` | Current investigations before they settle into durable pages. |
| `context/` | Product, market, competitor, user, fundraising, and strategy background. |
| `_manual/` | How to write and maintain this wiki. |
| `_meta/` | Local conventions, coverage notes, migration notes, and wiki-maintenance state. |

## Current Migration State

This tree is the new canonical browse structure. The legacy flat wiki is not
semantically migrated yet. Do not delete or ignore legacy pages: use them as
evidence, merge their durable knowledge into this tree over time, and keep
history in prose when it explains the current shape. [@legacy-readme]

## Runtime State

Readable wiki content belongs in `docs/almanac/`. Local runtime state belongs in
`.almanac/`, including `index.db`, job records, run logs, and review queues.
SQLite is a derived index, not the authoring source. [@decision-log]
