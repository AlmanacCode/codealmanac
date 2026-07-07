---
title: Health And Validation
topics: [architecture, wiki, health]
sources:
  - id: health-service
    type: file
    path: src/codealmanac/services/health/service.py
    note: Health and validation service entrypoints.
  - id: health-views
    type: file
    path: src/codealmanac/services/index/health_views.py
    note: Index-backed health report assembly.
  - id: health-graph
    type: file
    path: src/codealmanac/services/index/health_graph_views.py
    note: Graph, file-reference, topic, and page health queries.
  - id: health-sources
    type: file
    path: src/codealmanac/services/health/sources.py
    note: Source frontmatter shape validation.
  - id: health-source-views
    type: file
    path: src/codealmanac/services/index/health_source_views.py
    note: Citation and source usage checks.
  - id: health-runtime
    type: file
    path: src/codealmanac/services/health/runtime.py
    note: Runtime-state leak checks.
  - id: validate-tests
    type: file
    path: tests/test_validate.py
    note: Validation behavior and lifecycle validation tests.
---

# Health And Validation

Health and validation are the wiki's safety checks. `health` reports problems found in the indexed page graph, while `validate` turns those checks into a pass/fail boundary for commands and lifecycle runs [@health-service]. Validation also checks source frontmatter shape and runtime-state leaks before relying on the index-backed health report [@health-service] [@health-sources] [@health-runtime].

This matters because the committed `almanac/` tree is source. A lifecycle agent can write Markdown, but the run is not successful until the wiki can be indexed and validated [@validate-tests]. The same validation path is available to users before they commit wiki edits.

## Service Boundary

`HealthService.check` selects a repository and returns the index service's health report [@health-service]. It is a read-side diagnostic.

`HealthService.validate` is stricter. It gathers source shape issues and runtime-state issues, then calls `index.ensure_fresh`. If index refresh fails, the validation result records a `page_routes` issue and stops before running index health queries [@health-service]. If refresh succeeds, validation adds issues derived from the health report [@health-service].

`ensure_valid` wraps the same validation path and raises `ValidationFailed` when any issue exists [@health-service]. `OperationRunner` uses that method after a lifecycle agent writes pages, so invalid wiki output fails the run instead of being marked done.

## Indexed Health Report

The index-backed health report is assembled in `build_health_report`. It includes orphan pages, dead file references, broken page links, broken cross-wiki links, empty topics, empty pages, missing source citations, unused sources, and duplicate sources [@health-views].

Most of those checks are graph or page checks. Orphan pages have no topic rows. Dead file references point at missing repo paths. Broken Markdown links target missing page slugs. Empty topics have no pages, and empty pages have no meaningful body text after headings are ignored [@health-graph].

Source hygiene comes from a separate index view. Citation IDs are parsed from inline source markers in the body, then compared with the page's indexed `sources:` entries. The report flags citations with no matching source, sources that are never cited, and duplicate source IDs on one page [@health-source-views].

## Validation-Only Checks

Some checks happen before or outside the indexed report. Source shape validation opens every page and verifies that `sources:` is a list and that each source entry has an `id`, a supported `type`, and a target field such as `path` for file evidence [@health-sources].

Runtime-state validation rejects local state files and directories inside `almanac/`. The blocked names are `index.db`, `index.db-wal`, `index.db-shm`, `jobs`, and `runs`; the message points back to `~/.codealmanac/` as the correct runtime home [@health-runtime].

Route collisions are handled through index refresh. If two files map to the same page route, validation records a `page_routes` issue instead of leaking a traceback [@validate-tests].

## Lifecycle Role

Lifecycle operations rely on validation as their final quality gate. A test harness that writes a page with malformed source metadata causes ingest to raise `ValidationFailed`, and the persisted run ends in the failed state with a validation error [@validate-tests].

That makes validation more than a user command. It is part of the shared operation contract described by [Operation runner](../lifecycle/operation-runner): page-writing agents may mutate the wiki, but the run only succeeds after mutation safety, index refresh, and wiki validation all pass.
