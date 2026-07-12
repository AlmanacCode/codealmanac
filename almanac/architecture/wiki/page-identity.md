---
title: Page Identity
topics: [architecture, wiki, pages]
sources:
  - id: wiki-paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
    note: Page path iteration, reserved source folders, page id derivation, and path helpers.
  - id: wiki-documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: PageDocument loading, title fallback, topics, sources, file refs, links, and content hash.
  - id: index-sources
    type: file
    path: src/codealmanac/services/index/sources.py
    note: Document loading and route collision detection.
  - id: wiki-links
    type: file
    path: src/codealmanac/services/wiki/links.py
    note: Markdown page-link extraction and relative route resolution.
  - id: wiki-parsing-tests
    type: file
    path: tests/test_wiki_parsing.py
    note: Tests for frontmatter parsing, Markdown link resolution, and reference-path normalization.
  - id: concepts-doc
    type: file
    path: docs/concepts.md
    note: User-facing concept description of page ids, README routes, and route collisions.
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Current local-only runtime-state boundary.
---

# Page Identity

Page identity is the route a Markdown page gets from its path under `almanac/`. The route is not stored in frontmatter: `almanac/architecture/indexing.md` becomes `architecture/indexing`, and a folder `README.md` becomes the route for that folder [@wiki-paths] [@concepts-doc]. This makes the committed tree itself the page namespace.

The identity rule matters because the index, search results, page links, and route-collision checks all use the same slug. A page can change its title without changing its identity, but moving or renaming the Markdown file changes the route that other pages link to [@wiki-documents] [@index-sources].

## Path To Slug

`page_id_for_path(...)` requires a Markdown file relative to the repository's `almanac/` directory [@wiki-paths]. For ordinary pages, it removes the `.md` suffix and returns the POSIX-style relative path. For the root `README.md`, it returns `README`; for a nested `README.md`, it returns the folder path [@wiki-paths].

That gives these route shapes:

| File | Page slug |
|---|---|
| `almanac/README.md` | `README` |
| `almanac/architecture/README.md` | `architecture` |
| `almanac/architecture/wiki/page-identity.md` | `architecture/wiki/page-identity` |

When a page is loaded, `load_page_document(...)` uses that slug, keeps the Markdown file path, records the relative path, hashes the full raw file, and stores the filesystem mtime as `updated_at` [@wiki-documents]. The title comes from frontmatter, then the first H1, then the filename stem [@wiki-documents].

## Reserved Source Folders

The page iterator walks `almanac/**/*.md`, but it skips Markdown files beneath reserved wiki source directories [@wiki-paths]. The current reserved directories are `manual` and `jobs` [@wiki-paths]. This lets the wiki tree contain operational or manual material without turning every Markdown file in those internal areas into a public page route.

Reserved filtering happens before document loading, so skipped files do not receive slugs, links, topics, or file references in the derived index [@wiki-paths] [@index-sources].

The reserved `jobs` directory is protective compatibility, not permission for current runtime state to live under `almanac/`. The active runtime-state boundary keeps run records, logs, indexes, and scheduler state under `~/.codealmanac/`; wiki source under `almanac/` should remain authored Markdown and topic metadata [@live-agreement]. See [Local state layout](../../reference/local-state-layout) for the current runtime file layout.

## Route Collisions

Because `README.md` maps to its folder route, two different files can try to claim the same slug. For example, `almanac/architecture.md` and `almanac/architecture/README.md` both map to `architecture` [@concepts-doc]. `load_documents(...)` tracks seen slugs and raises a validation failure when two files map to the same page route [@index-sources].

This check protects links and search results from ambiguity. A page slug should identify one Markdown source file, not whichever file happened to be indexed first.

## Links Use Page Identity

CodeAlmanac uses normal Markdown links for page links. The link parser ignores external URLs, anchors, absolute paths, query strings, backslash paths, paths with spaces, and hrefs that look like files with suffixes [@wiki-links]. It resolves relative links against the source page's route, with special handling for folder landing pages [@wiki-links].

The parser tests show the intended behavior: relative links resolve against the source page route, while file-looking links such as `src/auth.py` are ignored as page links [@wiki-parsing-tests]. For example, from `architecture/indexing`, `wiki-tree` resolves to `architecture/wiki-tree`, and `../decisions/local-first-python` resolves to `decisions/local-first-python` by the same relative-route rule [@wiki-links] [@wiki-parsing-tests]. For the exact page-link rules, see [Links and routes](../../reference/page-format/links-and-routes).

## What Future Changes Must Preserve

The page namespace is path-based. Frontmatter may describe a page, cite evidence, and assign topics, but it does not own the route [@wiki-documents]. Future work on search, validation, or viewers should continue to treat nested Markdown path identity as the shared contract between the repo tree and the derived index.

The surrounding concept is [Local repo wiki](../../concepts/local-repo-wiki). Search and display behavior built on these slugs is covered in [Index refresh and search](index-refresh-and-search).
