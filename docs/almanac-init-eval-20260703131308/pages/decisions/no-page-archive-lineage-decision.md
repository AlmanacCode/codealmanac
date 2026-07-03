---
title: No Page Archive Lineage Decision
topics: [decisions, wiki]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: models
    type: file
    path: src/codealmanac/services/wiki/models.py
  - id: schema
    type: file
    path: src/codealmanac/services/index/schema.py
---

# No Page Archive Lineage Decision

The Python product model does not keep archive/supersede lineage fields for wiki pages. Git history is the archive [@agreement].

## Context

The archived implementation had archive-era page concepts. The live agreement explicitly removed `archived_at`, `superseded_by`, `supersedes`, `--include-archive`, and `--archived` unless the user reopens the decision [@agreement].

## Decision

The page model and index schema track active page data, sources, file refs, wikilinks, and topics, but not page lineage fields [@models] [@schema].

## Consequences

Search and health do not need archived-page scope flags. If future work needs historical page state, it should justify a new model rather than reintroducing hidden compatibility fields into [[wiki-page-model-and-link-parser]].
