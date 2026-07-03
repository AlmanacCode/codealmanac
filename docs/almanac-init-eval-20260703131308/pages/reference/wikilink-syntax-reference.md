---
title: Wikilink Syntax Reference
topics: [reference, wiki, links]
sources:
  - id: links
    type: file
    path: src/codealmanac/services/wiki/wikilinks.py
  - id: paths
    type: file
    path: src/codealmanac/services/wiki/paths.py
---

# Wikilink Syntax Reference

This page defines CodeAlmanac's single `[[...]]` link syntax. [[wiki-page-model-and-link-parser]] explains how links are extracted from Markdown tokens.

## Classification Rules

- `[[slug]]` or `[[slug|Label]]`: page link, normalized to kebab-case [@links].
- `[[src/path.py]]`: file reference because the target contains `/` [@links].
- `[[src/path/]]`: folder reference because it contains `/` and ends with `/` [@links].
- `[[other-wiki:slug]]`: cross-wiki link when `:` appears before any `/` [@links].

## Path Normalization

Paths are trimmed, backslashes become `/`, repeated slashes collapse, leading `./` is removed, leading `/` is removed, and any `..` path part rejects the reference [@paths]. Directory refs keep one trailing slash; comparison refs are casefolded [@paths].

Path mention queries must escape SQLite GLOB metacharacters with `escape_glob_meta()` before concatenating patterns [@paths].
