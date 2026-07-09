---
title: Architecture Overview
topics: [architecture, overview]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo architecture rules for living structure, seams, and implementation shape.
  - id: repo-readme
    type: file
    path: README.md
    note: Public product overview and local wiki/runtime split.
  - id: service-boundaries
    type: file
    path: almanac/architecture/service-boundaries.md
    note: Existing hub for dependency direction and owner boundaries.
  - id: lifecycle-workflows
    type: file
    path: almanac/architecture/lifecycle/workflows.md
    note: Existing page for build, ingest, garden, and sync workflow shape.
  - id: index-search
    type: file
    path: almanac/architecture/wiki/index-refresh-and-search.md
    note: Existing page for the derived wiki read model and search flow.
  - id: harness-contract
    type: file
    path: almanac/architecture/agent-runs/harness-contract.md
    note: Existing page for provider-neutral agent-run contracts.
---

# Architecture Overview

Architecture overview is the landing page for the architecture cluster. The pages in this folder explain how CodeAlmanac's local Python product divides responsibility between CLI adapters, the app composition root, workflows, services, stores, ports, integrations, and the committed wiki tree [@repo-readme] [@service-boundaries]. Use this page as a reading map before changing a subsystem.

The architecture rule for this repository is active design, not passive documentation. New work should reshape the codebase when a feature does not fit cleanly, prefer clear boundaries over local workarounds, and keep provider or persistence mechanics below the service-owned contracts [@manual] [@service-boundaries].

## Start With The Core Shape

Read [Service boundaries](service-boundaries) first. It explains the dependency direction from CLI and workflows into services, stores, ports, and integrations [@service-boundaries].

Then read [Composition root](composition-root) and [Request models](request-models). Those pages explain where dependencies are assembled and how shaped request objects keep raw CLI or provider state from leaking inward.

## Follow The Main Flows

For page-writing operations, read [Lifecycle workflows](lifecycle/workflows), then [Operation runner](lifecycle/operation-runner), [Run queue and sync](lifecycle/run-queue-and-sync), and [Mutation safety](lifecycle/mutation-safety). That path explains why build, ingest, and garden share execution, why sync only queues ingest work, and how final validation guards wiki writes [@lifecycle-workflows].

For read-side wiki behavior, read [Index refresh and search](wiki/index-refresh-and-search), [Page identity](wiki/page-identity), [Path normalization and file refs](wiki/path-normalization-and-file-refs), [Topics DAG](wiki/topics-dag), and [Health and validation](wiki/health-and-validation). Those pages explain how committed Markdown becomes a derived SQLite read model without making runtime state part of the wiki source [@index-search].

## Use Subsystem Pages For Edges

When work touches agent execution, use [Harness contract](agent-runs/harness-contract) before [Provider adapters](agent-runs/provider-adapters). The contract is the stable boundary; provider pages describe how Codex and Claude fit behind it [@harness-contract].

When work touches source inputs, use [Source resolution and runtime](sources/source-resolution-and-runtime). When work touches repository selection or runtime files, use [Repository selection and root](repositories/selection-and-root), [Repository local state](repositories/local-state), and [SQLite store boundaries](persistence/sqlite-store-boundaries).

When work touches user surfaces, use [CLI adapter boundary](cli/adapter-boundary), [Terminal output](cli/terminal-output), [Setup automation and update](setup/automation-and-update), and [Local viewer](viewer/local-viewer). These pages explain adapter behavior at the edges without making the edge the product core.
