---
title: Local Viewer
topics: [architecture, viewer]
sources:
  - id: viewer_service
    type: file
    path: src/codealmanac/services/viewer/service.py
    note: Viewer service entrypoints and projection flow.
  - id: projections
    type: file
    path: src/codealmanac/services/viewer/projections.py
    note: Conversion from service read models to viewer models.
  - id: viewer_js
    type: file
    path: src/codealmanac/server/assets/viewer/main.js
    note: Browser-side routing, repository selection, navigation, and page tree rendering.
  - id: viewer_tests
    type: file
    path: tests/test_viewer_service.py
    note: Tests for overview, search, pages, file refs, topics, jobs, and request validation.
---

# Local Viewer

The local viewer is a read-only projection over the repo wiki, topics, file evidence, and lifecycle jobs. `ViewerService` does not own a separate store. It selects a registered repository, reads from repository, index, run, and Markdown-renderer services, then returns viewer-specific models for the FastAPI/static browser surface [@viewer_service].

This makes the viewer a local inspection tool rather than another source of truth. Pages, links, topics, source references, and file references come from the index read model. Job lists and job detail come from the run ledger. The browser then routes between those projections with hash routes and renders the current repository's wiki graph [@viewer_service][@viewer_js].

## Service Shape

`ViewerService` is constructed with `RepositoriesService`, `IndexService`, `RunsService`, and `MarkdownRenderer` [@viewer_service]. Repository selection is handled through `ViewerRepositoryScope`, so every viewer request resolves the active repository before reading pages, topics, files, or jobs [@viewer_service].

The main entrypoints are `overview`, `page`, `search`, `file`, `topic`, `jobs`, and `job` [@viewer_service]. `overview` returns repository navigation, page and topic counts, a limited page list, a full navigation page list, topics, and a featured README page when present [@viewer_service]. `search` delegates to index search. `topic` normalizes the topic slug, reads the topic with optional descendants, and raises `NotFoundError` if the topic does not exist [@viewer_service].

## Page Projection

Page detail combines index data with rendered Markdown. `page` loads the `PageView`, renders the body, and returns title, summary, topics, raw body, HTML, backlinks, outgoing links, file references, sources, and related pages [@viewer_service]. Related pages are derived from incoming and outgoing page links, with duplicates and self-links removed [@viewer_service].

The projection module keeps conversion rules small and explicit. It maps repositories, topics, sources, and page summaries into viewer models [@projections]. Source display order follows citation order when the renderer reports citations; uncited sources sort after cited sources by source id [@projections]. File paths are shown relative to the repository's `almanac/` path when possible, with the old `pages/` prefix stripped if it appears in indexed data [@projections].

Tests make the reader contract concrete. The viewer renders Markdown links as viewer routes, escapes script tags, exposes code-formatted file references, reports backlinks, lists pages that mention file and folder references, and rejects file requests outside repo-relative reference space [@viewer_tests].

## Jobs And Runs

The viewer exposes lifecycle jobs through run service reads. `jobs` lists recent runs for the selected repository, and `job` attaches to a run snapshot to return the run plus normalized events [@viewer_service]. Tests verify that job detail includes run kind, status, summary, harness transcript metadata, status events, output events, and normalized harness event payloads [@viewer_tests].

This keeps the viewer aligned with the public `jobs` control surface without giving it its own job state. The viewer can show what happened, but the run ledger remains the owner of lifecycle state.

## Browser Routing

The static viewer script keeps local UI state for the overview and selected repository [@viewer_js]. On startup it wires the search form, repository selector, and `hashchange` listener, then loads the overview and routes the current hash [@viewer_js].

Routes cover home, page, topic, search, file, jobs, and job detail [@viewer_js]. Repository changes clear job polling, reload the overview for the selected wiki, refresh navigation, and reroute the current hash [@viewer_js]. Navigation is built from topics and a folder-style page tree, so nested wiki paths appear as browseable folders rather than a flat page list [@viewer_js].

The result is a thin local viewer. It improves navigation and inspection, while the durable contracts remain in the index, run ledger, repository registry, and Markdown page format.
