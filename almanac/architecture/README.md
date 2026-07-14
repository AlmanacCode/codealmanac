---
title: Architecture
topics: [architecture, overview]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo rule that features should reshape architecture before implementation when the current shape does not hold.
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph showing the major architecture neighborhoods.
  - id: service-boundaries
    type: file
    path: almanac/architecture/service-boundaries.md
    note: Architecture page for layer ownership and dependency direction.
  - id: composition-root
    type: file
    path: almanac/architecture/composition-root.md
    note: Architecture page for application graph assembly.
  - id: lifecycle
    type: file
    path: almanac/architecture/lifecycle/README.md
    note: Architecture hub for build, ingest, garden, sync, queueing, operation execution, and mutation safety.
  - id: index-search
    type: file
    path: almanac/architecture/wiki/index-refresh-and-search.md
    note: Architecture page for index refresh and read-side search.
  - id: wiki-architecture
    type: wiki
    path: architecture/wiki
    note: Architecture hub for page identity, file refs, indexing, topics, health, and validation.
  - id: operation-runner
    type: wiki
    path: architecture/lifecycle/operation-runner
    note: Architecture page for the shared lifecycle run-execution path.
  - id: mutation-safety
    type: wiki
    path: architecture/lifecycle/mutation-safety
    note: Architecture page for lifecycle write boundaries and validation.
  - id: page-identity
    type: wiki
    path: architecture/wiki/page-identity
    note: Architecture page for Markdown page routes.
  - id: path-normalization
    type: wiki
    path: architecture/wiki/path-normalization-and-file-refs
    note: Architecture page for normalized paths and file references.
  - id: topics-dag
    type: wiki
    path: architecture/wiki/topics-dag
    note: Architecture page for topic graph behavior.
  - id: health-validation
    type: wiki
    path: architecture/wiki/health-and-validation
    note: Architecture page for graph health and validation.
  - id: cli-adapter
    type: wiki
    path: architecture/cli/adapter-boundary
    note: Architecture page for CLI dispatch boundaries.
  - id: terminal-output
    type: wiki
    path: architecture/cli/terminal-output
    note: Architecture page for human and JSON terminal rendering.
  - id: harness-contract
    type: wiki
    path: architecture/agent-runs/harness-contract
    note: Architecture page for normalized harness execution.
  - id: provider-adapters
    type: wiki
    path: architecture/agent-runs/provider-adapters
    note: Architecture page for Codex and Claude provider adapters.
  - id: source-runtime
    type: wiki
    path: architecture/sources/source-resolution-and-runtime
    note: Architecture page for ingest source resolution and runtime snapshots.
  - id: local-state
    type: wiki
    path: architecture/repositories/local-state
    note: Architecture page for repository-local runtime state.
  - id: selection-root
    type: wiki
    path: architecture/repositories/selection-and-root
    note: Architecture page for repository selection and the fixed wiki root.
  - id: sqlite-stores
    type: wiki
    path: architecture/persistence/sqlite-store-boundaries
    note: Architecture page for SQLite store ownership.
  - id: local-viewer
    type: wiki
    path: architecture/viewer/local-viewer
    note: Architecture page for the local browser viewer.
  - id: request-models
    type: wiki
    path: architecture/request-models
    note: Architecture page for typed request objects at service and workflow boundaries.
  - id: agents-manuals
    type: wiki
    path: architecture/runtime-resources/prompts-and-manuals
    note: Architecture page for packaged prompt and manual runtime resources.
  - id: setup-automation
    type: wiki
    path: architecture/setup/automation-and-update
    note: Architecture page for setup-owned automation and update behavior.
---

# Architecture

Architecture pages explain the system areas that future work must preserve or reshape before adding behavior. The repo manual makes this explicit: implementation work should evolve the codebase so the feature fits, and should stop when the current shape cannot hold the request cleanly [@manual]. This hub gives the shortest route through the architecture cluster instead of requiring readers to scan every page under `architecture/`.

The architecture topic has focused child neighborhoods for wiki behavior, lifecycle operations, agent runs, CLI behavior, repositories, local state, automation, setup, runtime resources, persistence, sources, and the viewer [@topics]. Read the page that owns the boundary you plan to change, then follow its links into guides, decisions, or reference pages.

## Core Shape

Start with [Service boundaries](service-boundaries). It explains the main dependency direction: CLI adapters enter through the app, workflows coordinate product operations, services own product verbs, stores own persistence, ports describe outside capabilities, and integrations implement those ports [@service-boundaries].

[Composition root](composition-root) is the companion page for construction. It explains how `src/codealmanac/app.py` assembles stores, services, adapters, operation runners, and workflows into one application graph [@composition-root].

[Request models](request-models) explains the typed request objects that protect service and workflow boundaries from loose dictionaries and raw CLI shapes [@request-models].

## Page-Writing Operations

[Lifecycle](lifecycle/) is the entry point for build, ingest, garden, sync, queued runs, operation execution, and mutation safety. Build, ingest, and garden are page-writing operation families; sync is a scanner that queues ingest work instead of writing pages itself [@lifecycle].

Use [Operation runner](lifecycle/operation-runner) when changing the shared run-execution path [@operation-runner]. Use [Mutation safety](lifecycle/mutation-safety) when changing the checks that keep lifecycle writes inside the allowed wiki source files [@mutation-safety].

## Read Side And Wiki Graph

[Wiki architecture](wiki/) is the entry point for page identity, path and file references, indexing, topics, health, and validation [@wiki-architecture].

[Index refresh and search](wiki/index-refresh-and-search) explains the derived SQLite read model, implicit refresh before read commands, FTS search, topic filters, and mention search [@index-search].

For authored wiki contracts, read [Page identity](wiki/page-identity), [Path normalization and file refs](wiki/path-normalization-and-file-refs), [Topics DAG](wiki/topics-dag), and [Health and validation](wiki/health-and-validation). These pages define how Markdown routes, sources, topics, and validation fit together [@page-identity] [@path-normalization] [@topics-dag] [@health-validation].

## Edges And Interfaces

Use [CLI adapter boundary](cli/adapter-boundary) and [Terminal output](cli/terminal-output) for command entrypoints and rendering [@cli-adapter] [@terminal-output]. Use [Harness contract](agent-runs/harness-contract) and [Provider adapters](agent-runs/provider-adapters) for Codex and Claude execution boundaries [@harness-contract] [@provider-adapters]. Use [Source resolution and runtime](sources/source-resolution-and-runtime) when changing ingest inputs or source adapters [@source-runtime].

[Agents and manuals](runtime-resources/prompts-and-manuals) covers the packaged Yoke agents and writing references used by lifecycle runs, and [Setup automation and update](setup/automation-and-update) covers setup-owned scheduler and update behavior [@agents-manuals] [@setup-automation].

[Local state](repositories/local-state), [Selection and root](repositories/selection-and-root), and [SQLite store boundaries](persistence/sqlite-store-boundaries) explain repository selection, runtime paths, and persistence ownership [@local-state] [@selection-root] [@sqlite-stores]. [Local viewer](viewer/local-viewer) explains the browser UI that projects the same wiki, topics, files, and jobs [@local-viewer].
