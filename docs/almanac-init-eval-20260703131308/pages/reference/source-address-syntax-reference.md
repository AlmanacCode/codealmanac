---
title: Source Address Syntax Reference
topics: [reference, sources]
sources:
  - id: resolver
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
  - id: models
    type: file
    path: src/codealmanac/services/sources/models.py
---

# Source Address Syntax Reference

This page lists source address forms accepted by ingest source resolution. [[source-resolution-and-runtimes]] explains the architecture.

## Address Families

- `github:...`: GitHub shorthand, resolved by the GitHub address module [@resolver].
- `git:range:...`: Git revision range source [@resolver].
- `git:diff` or `git:diff:...`: Git working tree or target diff source [@resolver].
- `transcript:...`: transcript source path [@resolver].
- `http://...` or `https://...`: web URL source [@resolver].
- Anything else: local filesystem path resolved relative to cwd [@resolver].

## Source Kinds

Source refs can be `path.file`, `path.directory`, `path.unknown`, `github.pull_request`, `github.issue`, `web.url`, `git.range`, `git.diff`, or `transcript` [@models].
