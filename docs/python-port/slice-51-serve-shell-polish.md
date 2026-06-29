# Slice 51 - Serve Shell Polish

Date: 2026-06-29

## Scope

Polish the local `serve` shell so it follows the agreed sidebar-first
CodeAlmanac reader shape. This slice does not add React, Next.js, hosted wiki
routes, source-code preview, or a new viewer service.

## Product Decision

The viewer should feel like a local repo wiki browser. UseAlmanac remains a
visual reference for colors, rail polish, and account-picker feel, but the
current hosted UseAlmanac wiki page-list/search interaction is not the target.

## Changes

- The rail account area labels the current wiki as a repo-owned local wiki.
- The sidebar names the graph scope as `Local knowledge graph`.
- Page and topic rail links carry route metadata and receive active state when
  their route is open.
- CSS gives the rail account trigger a clearer picker treatment and highlights
  active page/topic links.
- Mobile hides dense topic/page rail lists and keeps the compact top nav.
- Viewer CSS no longer uses viewport-scaled font sizes.

## Verification

- Focused tests: `uv run pytest tests/test_server.py tests/test_architecture.py -q`
  passed with 16 tests.
- Live pinned-project static/API dogfood: temp repo, isolated `HOME`,
  `uv --project /Users/rohan/Desktop/Projects/codealmanac run codealmanac serve`,
  `curl /`, `/assets/viewer/main.js`, `/api/overview`, and `/api/page/auth-flow`
  returned the expected CodeAlmanac viewer assets and wiki payloads.
- Browser-harness visual dogfood passed through an isolated temporary Chrome
  profile launched with an explicit CDP port. Desktop checks covered overview,
  page, topic, and search route state with no horizontal overflow. Mobile checks
  covered a 390px page route: dense rail sections collapsed, the side panel
  collapsed, search fit inside the viewport, and no horizontal overflow appeared.
