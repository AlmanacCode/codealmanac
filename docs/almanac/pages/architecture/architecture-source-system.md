---
page_id: architecture-source-system
title: Source System
summary: The source system resolves raw ingest inputs and asks runtime adapters for concrete source snapshots.
topics: [architecture, integration, lifecycle]
sources:
  - id: sources-service
    type: file
    path: src/codealmanac/services/sources/service.py
  - id: source-resolution
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
---

# Source System

The source system turns raw ingest inputs into structured source references and runtime snapshots. `SourcesService.resolve()` classifies input addresses, and `SourcesService.inspect_runtime()` selects the first runtime adapter that supports the resolved reference. [@sources-service] [@source-resolution]

## Why does it sit before the harness?

Ingest builds its prompt from resolved sources and source runtime snapshots. That means the harness receives concrete evidence instead of guessing what an input string means. [@ingest]

## What happens during transcript sync?

Sync creates ingest inputs with the `transcript:` prefix, so transcript material flows through the same source-resolution and ingest path as other sources. [@ingest]

## What explains each adapter?

Read `[[architecture-source-adapters]]` and `[[reference-source-addresses]]`.

