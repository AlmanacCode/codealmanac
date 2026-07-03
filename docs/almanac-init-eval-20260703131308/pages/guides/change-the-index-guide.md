---
title: Change The Index Guide
topics: [guides, index, wiki]
sources:
  - id: wiki
    type: file
    path: src/codealmanac/services/wiki/documents.py
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
  - id: projection
    type: file
    path: src/codealmanac/services/index/projection.py
  - id: tests
    type: file
    path: tests/test_read_model.py
---

# Change The Index Guide

Use this guide when changing page parsing, source/frontmatter handling, derived SQLite schema, projection, search, show, or health behavior. The safe outcome is a rebuildable read model whose source of truth remains Markdown under the configured Almanac root.

## Steps

1. If the Markdown contract changes, update `services/wiki/` first and document it in [[wiki-file-format-reference]] or [[wikilink-syntax-reference]] [@wiki].
2. If stored data changes, update `services/index/schema.py` and bump the derived schema version [@schema].
3. Update projection writes so every table can be rebuilt from page documents and `topics.yaml` [@projection].
4. Update query-family views rather than mixing read SQL into the store facade.
5. Add or adjust health checks when the change creates a new integrity invariant.

## Verification

Run `tests/test_read_model.py`, `tests/test_wiki_parsing.py`, `tests/test_topics_health.py`, and relevant CLI tests. Also run `uv run ruff check .`.
