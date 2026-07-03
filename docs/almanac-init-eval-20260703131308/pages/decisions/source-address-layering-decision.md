---
title: Source Address Layering Decision
topics: [decisions, sources]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: models
    type: file
    path: src/codealmanac/services/sources/models.py
  - id: resolver
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
---

# Source Address Layering Decision

Source input uses four layers: `SourceAddress`, `SourceRef`, `SourceBrief`, and `SourceRuntime`. This keeps address syntax, identity, prompt hinting, and runtime material separate [@agreement] [@models].

## Context

Ingest can accept local paths, Git ranges/diffs, GitHub PR/issues, web URLs, and transcripts. Each source family needs parsing and runtime material, but lifecycle workflows should not branch on provider details.

## Decision

Address parsing is split by family modules and dispatched by `address_resolution.py`; runtime material comes from adapters behind the `SourceRuntimeAdapter` port [@resolver].

## Consequences

New source families should follow [[add-a-source-runtime-guide]] and update [[source-address-syntax-reference]]. Do not add source-specific branches to `IngestWorkflow`.
