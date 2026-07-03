---
page_id: reference-cli-commands
title: CLI Commands
summary: This page lists the public CodeAlmanac command families and the command names currently parsed by the Python CLI.
topics: [reference]
sources:
  - id: parser-root
    type: file
    path: src/codealmanac/cli/parser/root.py
  - id: parser-lifecycle
    type: file
    path: src/codealmanac/cli/parser/lifecycle.py
  - id: parser-wiki
    type: file
    path: src/codealmanac/cli/parser/wiki.py
  - id: parser-admin
    type: file
    path: src/codealmanac/cli/parser/admin.py
---

# CLI Commands

The Python CLI exposes one command, `codealmanac`, with lifecycle, wiki, and admin command families. This page is reference material for command names and high-level grouping; use guides for task flow. [@parser-root]

## Lifecycle commands

| Command | Purpose |
|---|---|
| `init` | Initialize a local wiki. |
| `build` | Build or refresh a local wiki. |
| `ingest` | Ingest selected local material. |
| `garden` | Improve the existing wiki graph. |
| `sync` | Sync quiet local transcripts. |
| `sync status` | Show sync readiness. |
| `__run-worker` | Hidden queue-drain entrypoint. |

These commands are defined in the lifecycle parser. [@parser-lifecycle]

## Wiki commands

| Command | Purpose |
|---|---|
| `list` | List registered local wikis, or drop registry entries. |
| `search` | Search indexed pages. |
| `show` | Show one page or a page projection. |
| `topics` | List, show, or mutate topics. |
| `health` | Check wiki graph and source health. |
| `reindex` | Force index rebuild. |
| `serve` | Start the local viewer. |
| `tag` | Add topics to a page. |
| `untag` | Remove topics from a page. |

These commands are defined in the wiki parser. [@parser-wiki]

## Admin commands

Admin parser construction delegates setup, diagnostics, update, jobs, and automation command definitions to separate parser modules. [@parser-admin]

## Related pages

Read `[[architecture-cli-boundary]]` for architecture and `[[guide-add-cli-command]]` for maintenance.

