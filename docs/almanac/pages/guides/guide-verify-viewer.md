---
page_id: guide-verify-viewer
title: Verify The Viewer
summary: Use this guide after viewer or wiki-output changes to confirm that the local browser surface can render overview, page, topic, search, file, and job views.
topics: [guides]
sources:
  - id: viewer-service
    type: file
    path: src/codealmanac/services/viewer/service.py
  - id: server-app
    type: file
    path: src/codealmanac/server/app.py
  - id: readiness
    type: file
    path: docs/python-port/public-release-readiness.md
---

# Verify The Viewer

Use this guide after changing viewer code, markdown rendering, page metadata, links, topics, jobs, or server assets. The goal is to confirm that the local viewer can render the indexed wiki and that the browser surface still covers overview, page, topic, search, file-reference, and job routes. [@viewer-service] [@server-app] [@readiness]

## Preconditions

Use a repo with an initialized wiki and at least one page. Run the command from a directory that resolves to that wiki.

## Steps

1. Start `codealmanac serve`.
2. Open the overview route.
3. Open one page route and check rendered markdown.
4. Open a topic route.
5. Search for a term that should return a page.
6. Open a file-reference route if the wiki has file links.
7. Open the jobs route if the wiki has lifecycle runs.

## Verification

The public release gate expects browser proof over overview, page, topic, search, file refs, and no horizontal overflow. [@readiness]

## Recovery

If a route fails, inspect `[[architecture-local-viewer]]` first. If markdown renders but links are wrong, inspect `[[reference-wikilink-syntax]]`.

