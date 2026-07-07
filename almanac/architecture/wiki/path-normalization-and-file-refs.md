---
title: Path Normalization And File Refs
topics: [architecture, wiki, search, sources]
sources:
  - id: wiki-paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
    note: File-reference normalization, directory detection, parent prefix generation, and GLOB escaping.
  - id: wiki-documents
    type: file
    path: src/codealmanac/services/wiki/documents.py
    note: Conversion from page sources to indexed file references.
  - id: search-views
    type: file
    path: src/codealmanac/services/index/search_views.py
    note: File mention query clauses for exact, parent-directory, and folder matches.
  - id: index-schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: Indexed file_refs table shape and path index.
  - id: wiki-parsing-tests
    type: file
    path: tests/test_wiki_parsing.py
    note: Tests for path normalization and escaped GLOB metacharacters.
  - id: slice-2-fixes
    type: file
    path: docs/plans/fixes-slice-2-review.md
    note: Review finding that explains the escaped GLOB bug and desired mention-search behavior.
---

# Path Normalization And File Refs

Path normalization and file refs connect page evidence to search. A page records file evidence in `sources:` frontmatter; the index turns file sources into normalized `file_refs` rows; `codealmanac search --mentions ...` then matches those rows against a queried path [@wiki-documents] [@index-schema] [@search-views]. The point is to make evidence paths useful even when authors type different slashes, case, or directory suffixes.

The normalization contract is strict because path search is a correctness surface. CodeAlmanac lowercases file-reference paths for matching, keeps an original-case display path, treats directory refs differently from file refs, and escapes SQLite `GLOB` metacharacters before prefix matching [@wiki-paths] [@wiki-documents] [@search-views].

## Normalized Shape

`normalize_reference_shape(...)` trims whitespace, changes backslashes to forward slashes, removes repeated leading `./`, collapses duplicate slashes, strips a leading slash, rejects any path containing `..`, and removes trailing slashes before adding one back for directory refs [@wiki-paths]. `normalize_reference_path(...)` then casefolds that shape for matching [@wiki-paths].

Directory detection is syntax-based. `looks_like_dir(...)` treats a raw path as a directory when the trimmed path ends with `/` after backslashes are converted to forward slashes [@wiki-paths]. A source path such as `Src/Auth/` is therefore indexed as the normalized directory ref `src/auth/`, while `Src/Auth.py` is indexed as the file ref `src/auth.py` [@wiki-paths] [@wiki-documents].

## From Sources To File Refs

Only frontmatter sources with `type: file` become file refs. `source_file_refs(...)` ignores non-file sources, normalizes the target path, preserves the normalized original-case form, and records whether the source was a directory [@wiki-documents]. Empty normalized paths are skipped, so unsafe parent-relative paths do not enter the index [@wiki-documents] [@wiki-paths].

File refs are deduplicated by normalized path and directory flag before indexing [@wiki-documents]. The derived schema stores `page_slug`, normalized `path`, `original_path`, and `is_dir`, with an index on `path` for lookup [@index-schema].

## Mention Search

Mention search normalizes the query path with the same rules used for page sources [@search-views]. If the query is a directory, search matches a page when the indexed ref is exactly that directory or when the indexed ref is below that directory by `GLOB` prefix [@search-views]. The prefix pattern escapes stored metacharacters before appending `*` [@search-views] [@wiki-paths].

If the query is a file, search matches an exact file ref. It also matches directory refs for any parent folder of that file, so a page that cites `src/checkout/` is found by `--mentions src/checkout/handler.py` [@search-views]. Parent folder prefixes are generated as slash-suffixed paths such as `src/` and `src/checkout/` [@wiki-paths].

## Escaped GLOB

SQLite `GLOB` treats `*`, `?`, and `[...]` as pattern syntax. The slice 2 review found that unescaped paths such as `src/[id]/page.tsx` could cause spurious mention matches because `[id]` is interpreted as a character class [@slice-2-fixes]. The current helper `escape_glob_meta(...)` wraps `*`, `?`, and `[` so they are matched literally before a directory-prefix `*` is appended [@wiki-paths].

The parser tests preserve that behavior. They normalize `./Src/[id]/Page.tsx` to `src/[id]/page.tsx` and assert that the opening bracket is escaped before the path is used in a `GLOB` pattern [@wiki-parsing-tests]. The same tests assert that absolute-looking paths are made repo-relative and parent-relative paths normalize to an empty string [@wiki-parsing-tests].

## Consequences

File refs are evidence metadata, not page links. They belong in structured `sources:` entries and power mention search through the derived index [@wiki-documents] [@search-views]. For the page metadata contract, see [Frontmatter and sources](../../reference/page-format/frontmatter-and-sources). For the search read model that consumes file refs, see [Index refresh and search](index-refresh-and-search). The decision to use Markdown links plus structured sources is covered by [Markdown links and sources](../../decisions/markdown-links-and-sources).
