---
title: Manual Overview
topics: []
---

# Manual Overview

This manual defines how agents maintain a CodeAlmanac repo-owned wiki.

Prompts name the run. The manual explains how to write the pages.

Read the relevant page before editing:

- `how-to-write.md`: the general writing standard for all pages.
- `evidence.md`: how claims stay grounded and how conflicts are handled.
- `links.md`: how wiki pages, files, folders, and hubs connect.
- `topics.md`: how topic graphs support querying and browsing.
- `concepts.md`: how to write concept pages.
- `architecture.md`: how to write architecture pages.
- `how-to-guides.md`: how to write task guides.
- `decisions.md`: how to write decision pages.
- `reference.md`: how to write reference pages.
- `sources.md`: how raw material relates to wiki synthesis.
- `ingest.md`: how to fold new material into an existing wiki.
- `garden.md`: how to improve an existing wiki graph.

Repo-specific conventions live in `README.md` and `topics.yaml` under the
configured Almanac root.

## Folder Structure

The configured Almanac root is flat. A new repo defaults to `almanac/`, but a
repo may explicitly use another safe repo-relative directory such as
`docs/almanac/` or `.almanac/`.

```text
<almanac-root>/
|-- README.md
|-- topics.yaml
|-- pages/
|   |-- concepts/
|   |-- architecture/
|   |-- guides/
|   |-- decisions/
|   `-- reference/
|-- manual/
```

`topics.yaml` plus `pages/` identify an initialized CodeAlmanac wiki. `README.md`
is guidance for readers and writers, not a marker by itself.

The category folders under `pages/` are the default first-build structure. Do
not add `active/`, `_meta/`, or `context/` during init unless repository
evidence makes that structure necessary.

Runtime state is local and rebuildable:

```text
<almanac-root>/index.db
<almanac-root>/index.db-wal
<almanac-root>/index.db-shm
~/.codealmanac/runs/<workspace-id>/
```

`~/.codealmanac/runs/<workspace-id>/` contains foreground run logs, queued
background specs, worker locks, and sync ledger state. It is not wiki source.
