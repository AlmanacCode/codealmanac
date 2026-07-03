---
title: Search, Show, And Health Flow
topics: [architecture, index, cli]
sources:
  - id: dispatch
    type: file
    path: src/codealmanac/cli/dispatch/wiki.py
  - id: search
    type: file
    path: src/codealmanac/services/search/service.py
  - id: pages
    type: file
    path: src/codealmanac/services/pages/service.py
  - id: health
    type: file
    path: src/codealmanac/services/health/service.py
---

# Search, Show, And Health Flow

The wiki read commands are thin service calls over [[sqlite-index-read-model]]. `dispatch_wiki()` routes `search`, `show`, `topics`, `health`, `reindex`, `serve`, `tag`, and `untag` to the app services and then renderers format results [@dispatch].

`SearchService.search()` resolves the workspace, asks the index service for query/topic/mentions results, and returns `SearchPageResult` rows [@search]. `PagesService.show()` resolves a page through the index and returns a `PageView` with metadata, body, links, sources, and file refs [@pages].

`HealthService.check()` resolves the workspace and asks the index service for a health report [@health]. The health categories are exact in [[index-schema-reference]], and topic mutation behavior is covered in [[topics-dag-and-mutations]].
