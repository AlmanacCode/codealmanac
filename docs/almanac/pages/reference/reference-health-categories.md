---
page_id: reference-health-categories
title: Health Categories
summary: This page lists the health categories generated from the indexed wiki graph and source metadata.
topics: [reference]
sources:
  - id: health-models
    type: file
    path: src/codealmanac/services/index/models.py
  - id: health-views
    type: file
    path: src/codealmanac/services/index/health_views.py
  - id: health-graph
    type: file
    path: src/codealmanac/services/index/health_graph_views.py
  - id: health-sources
    type: file
    path: src/codealmanac/services/index/health_source_views.py
---

# Health Categories

Health reports describe graph, file-reference, cross-wiki, topic, page, and source-citation problems found in the indexed wiki. The health view combines graph checks and source checks into one report. [@health-models] [@health-views] [@health-graph] [@health-sources]

## Categories

| Category | Meaning |
|---|---|
| Orphans | Pages with no topic membership. |
| Dead refs | File or folder references that do not resolve. |
| Broken links | Page links that do not target an indexed page. |
| Broken cross-wiki links | Cross-wiki links whose target wiki or page is missing. |
| Empty topics | Topics with no pages. |
| Empty pages | Pages with no body content. |
| Missing source citations | Source ids that are listed but not cited inline. |
| Unused sources | Source entries not used by citations. |
| Duplicate sources | Repeated source ids on a page. |

These categories are modeled and built by the index health modules. [@health-models] [@health-views] [@health-sources]

## Related pages

Use `[[guide-debug-failed-run]]` when health failures appear after lifecycle work.

