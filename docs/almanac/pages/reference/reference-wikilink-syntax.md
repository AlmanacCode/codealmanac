---
page_id: reference-wikilink-syntax
title: Wikilink Syntax
summary: This page lists the `[[...]]` link forms parsed by CodeAlmanac.
topics: [reference]
sources:
  - id: wikilinks
    type: file
    path: src/codealmanac/services/wiki/wikilinks.py
  - id: paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
---

# Wikilink Syntax

CodeAlmanac uses one `[[...]]` syntax for page links, file references, folder references, and cross-wiki links. The classifier looks at the target text to decide the link kind. [@wikilinks]

## Forms

| Form | Kind |
|---|---|
| Example text | Kind |
|---|---|
| page slug without a slash | Page link. |
| source file path with a slash | File reference. |
| source folder path with a trailing slash | Folder reference. |
| wiki name, colon, then page slug | Cross-wiki reference. |

Targets with a colon before any slash are cross-wiki links. Targets with a slash are file or folder references. Other targets are normalized as page slugs. [@wikilinks]

## Path normalization

File and folder references normalize slashes, remove leading `./`, reject `..`, and preserve a trailing slash for folders. [@paths]

## Related pages

Read the manual page `manual/sourcing-and-linking.md` for linking rules.
