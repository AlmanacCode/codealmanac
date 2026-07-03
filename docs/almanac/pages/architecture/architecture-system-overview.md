---
page_id: architecture-system-overview
title: System Overview
summary: The Python CodeAlmanac system is a local CLI that resolves a workspace, reads or mutates a repo-local wiki, and keeps provider-specific work behind service-owned ports.
topics: [architecture]
sources:
  - id: app
    type: file
    path: src/codealmanac/app.py
  - id: readme
    type: file
    path: README.md
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# System Overview

The Python CodeAlmanac system is a local-only command-line product that maintains a repo-local wiki. The application composition root wires CLI-facing services, write-capable workflows, local storage, provider harnesses, source adapters, automation, diagnostics, setup, updates, and the local viewer into one `CodeAlmanac` object. [@readme] [@live-agreement] [@app]

## What are the main layers?

| Layer | Responsibility |
|---|---|
| CLI | Parse commands, build request models, render results. |
| Services | Own product verbs such as workspace resolution, indexing, topics, runs, sources, and harness selection. |
| Workflows | Compose services for lifecycle operations such as build, ingest, garden, queue, and sync. |
| Integrations | Talk to external systems such as Codex, Claude, launchd, Git, GitHub, web pages, subprocesses, and package managers. |
| Server | Serve the local read-only wiki viewer. |

## What is the core flow?

Read commands resolve a `[[concept-workspace]]`, refresh the derived index when needed, and return indexed wiki data. Write-capable lifecycle commands create a `[[concept-lifecycle-run]]`, prepare operation context, call a `[[concept-harness]]`, validate that changed files stay under the Almanac root, then refresh the index. [@app]

## What pages explain the system?

Start with `[[architecture-composition-root]]`, then follow `[[architecture-cli-boundary]]`, `[[architecture-workspaces-and-roots]]`, `[[architecture-index-read-model]]`, and `[[architecture-lifecycle-workflows]]`.

