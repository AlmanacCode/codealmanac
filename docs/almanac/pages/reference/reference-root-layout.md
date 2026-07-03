---
page_id: reference-root-layout
title: Root Layout
summary: This page lists the initialized Almanac root files and derived runtime paths.
topics: [reference, storage]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: wiki-service
    type: file
    path: src/codealmanac/services/wiki/service.py
  - id: readme
    type: file
    path: README.md
---

# Root Layout

An initialized Almanac root contains committed source files and may later contain derived runtime files. CodeAlmanac detects a wiki root by `topics.yaml` plus `pages/`, not by `README.md` alone. [@manual] [@readme]

## Source files

| Path | Meaning |
|---|---|
| `README.md` | Wiki guidance for readers and writers. |
| `topics.yaml` | Topic definitions and parent relationships. |
| `pages/` | Markdown pages. |
| `manual/` | Bundled and repo-local writing guidance. |

`WikiService.initialize()` creates these paths and writes missing starter files. [@wiki-service]

## Derived files

| Path | Meaning |
|---|---|
| `index.db` | SQLite read model. |
| `index.db-wal` | SQLite write-ahead log file. |
| `index.db-shm` | SQLite shared-memory file. |
| `jobs/` | Run records, specs, logs, transcripts, and locks. |

These paths are local runtime state. [@manual] [@readme]

## Related pages

Read `[[architecture-wiki-root-layout]]` and `[[concept-almanac-root]]`.

