---
title: Links And Routes
topics: [reference, page-format, links]
sources:
  - id: wiki_links
    type: file
    path: src/codealmanac/services/wiki/links.py
    note: Markdown link extraction and relative page-route resolution.
  - id: wiki_paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
    note: Page route derivation from paths and reserved wiki source directories.
  - id: wiki_documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: Page document loading, link extraction inputs, and stored page links.
  - id: links_manual
    type: file
    path: src/codealmanac/manual/links.md
    note: Authoring manual for wiki page links.
  - id: wiki_parsing_tests
    type: file
    path: tests/test_wiki_parsing.py
    note: Tests for Markdown page-link resolution, ignored hrefs, and folder landing behavior.
  - id: health_graph
    type: file
    path: src/codealmanac/services/index/health_graph_views.py
    note: Broken Markdown page-link validation.
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current local-only runtime-state boundary.
---

# Links And Routes

CodeAlmanac uses normal Markdown links for page-to-page navigation. A link such as `[Page identity](../../architecture/wiki/page-identity)` is parsed from the Markdown body and resolved to a page slug; double-bracket links are not part of the current page format [@wiki_links] [@links_manual]. File evidence belongs in `sources:`, not in Markdown links.

Routes come from paths under `almanac/`. An ordinary Markdown file drops its `.md` suffix, while a `README.md` maps to its folder route; the root `README.md` maps to `README` [@wiki_paths]. The route contract is explained in [Page identity](../../architecture/wiki/page-identity), and this page defines how authored Markdown links resolve against that route space.

## Page Routes

`page_id_for_path()` requires a Markdown file under the repository's `almanac/` directory [@wiki_paths]. `almanac/reference/page-format/links-and-routes.md` becomes `reference/page-format/links-and-routes`; `almanac/architecture/README.md` becomes `architecture`; and `almanac/README.md` becomes `README` [@wiki_paths].

The page iterator walks Markdown files below `almanac/`, but skips files inside reserved source directories [@wiki_paths]. The reserved directories are `manual` and `jobs` [@wiki_paths]. That skip is a route-indexing guard; current runtime state still belongs under `~/.codealmanac/`, not in `almanac/jobs` [@live_agreement].

## Resolved Markdown Links

The parser reads CommonMark inline links from the page body and resolves eligible hrefs to page slugs [@wiki_links]. Relative links are resolved against the source page's route. For a normal page, the base is the page's parent folder; for a folder landing page, the base is the folder route itself [@wiki_links].

Examples show the rule. From `architecture/indexing`, `wiki-tree` resolves to `architecture/wiki-tree`, and `../decisions/local-only-python-product` resolves to `decisions/local-only-python-product` [@wiki_links]. From the folder landing page `architecture`, `wiki-tree` resolves to `architecture/wiki-tree` [@wiki_parsing_tests].

## Ignored Hrefs

Not every Markdown link is a page link. The resolver ignores empty hrefs, anchors, slash-rooted paths, backslash paths, external URLs, links with a query string, paths with spaces, and hrefs that look like file paths because their final path segment contains a dot [@wiki_links]. Tests assert that `/architecture/viewer`, `https://example.com`, `#section`, and `src/auth/session.py` do not become page links [@wiki_parsing_tests].

This keeps navigation separate from evidence. A source file path should be recorded as a `type: file` source in [Frontmatter and sources](frontmatter-and-sources), not as an inline page link.

## Broken Link Validation

Loaded page documents store sorted, deduplicated outgoing page links [@wiki_documents]. The health graph view reports a broken Markdown page link when a stored `page_links` target does not match any indexed page slug [@health_graph]. Cross-wiki link rows have a separate table and health category, but current Markdown link extraction records local page links only [@wiki_documents].

The links manual says to link only real targets, or pages being created in the same run [@links_manual]. When a build or Garden run has a page plan, use it as local planning context rather than finished article content, then verify with [Verify a wiki change](../../guides/verify-a-wiki-change) when a wiki update needs checking.
