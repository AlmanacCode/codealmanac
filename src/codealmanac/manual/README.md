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
- `links.md`: how wiki pages and hubs connect.
- `topics.md`: how topic graphs support querying and browsing.
- `concepts.md`: how to write concept pages.
- `architecture.md`: how to write architecture pages.
- `how-to-guides.md`: how to write task guides.
- `decisions.md`: how to write decision pages.
- `reference.md`: how to write reference pages.
- `sources.md`: how raw material relates to wiki synthesis.
- `ingest.md`: how to fold new material into an existing wiki.
- `garden.md`: how to improve an existing wiki graph.

Repo-specific conventions live in `almanac/README.md` and
`almanac/topics.yaml`.

## Folder Structure

The only repo wiki root is `almanac/`. The committed wiki source is a
browseable Markdown tree.

```text
almanac/
|-- README.md
|-- topics.yaml
|-- concepts/
|   `-- sources.md
|-- architecture/
|   |-- README.md
|   `-- indexing.md
|-- decisions/
|   `-- local-first.md
|-- guides/
|   `-- setup.md
`-- reference/
    `-- page-format.md
```

`almanac/README.md` plus `almanac/topics.yaml` identify an initialized
CodeAlmanac wiki.

Runtime state is local and rebuildable:

```text
~/.codealmanac/repos/<repo-id>/index.db
~/.codealmanac/repos/<repo-id>/runs/
```

Runtime files contain foreground run logs, queued background specs, worker
locks, and sync ledger state. They are not wiki source.
