---
page_id: wiki-conventions
title: Wiki Conventions
topics: [concepts]
sources:
  - id: decision-log
    type: file
    path: docs/plans/2026-06-13-docs-almanac-decision-log.md
    note: Records current local conventions for docs/almanac and legacy compatibility.
---

# Wiki Conventions

This page records local conventions for the CodeAlmanac wiki. Update it when
folder, naming, source, citation, migration, or coverage rules change.

## Current Conventions

- `docs/almanac/README.md` is the front door.
- `docs/almanac/topics.yaml` is the canonical topic file.
- `.almanac/` stores runtime state and legacy pages during migration.
- New pages use `page_id`, `title`, `topics`, and `sources`.
- `summary` is optional; the lead should usually summarize the page.
- `_manual/` explains how to maintain the wiki.
- `_meta/` records conventions, coverage, migration state, and source gaps.

## Migration Convention

Do not mechanically move every legacy page in one pass unless the task is a
dedicated migration. When touching a subject, migrate or rewrite the relevant
legacy knowledge into the new folder structure and cite the sources that support
the current claims.
