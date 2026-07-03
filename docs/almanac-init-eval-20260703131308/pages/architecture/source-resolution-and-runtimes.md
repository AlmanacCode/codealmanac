---
title: Source Resolution And Runtimes
topics: [architecture, sources]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/sources/service.py
  - id: models
    type: file
    path: src/codealmanac/services/sources/models.py
  - id: resolver
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
  - id: adapters
    type: file
    path: src/codealmanac/integrations/sources/__init__.py
---

# Source Resolution And Runtimes

Source resolution turns raw ingest inputs into prompt-ready material. `SourcesService.resolve()` maps each input to a `SourceBrief`; `inspect_runtime()` selects the first runtime adapter that supports the resulting `SourceRef` [@service].

The resolver dispatches by syntax: `github:`, `git:range:`, `git:diff`, `transcript:`, HTTP(S) URLs, and paths [@resolver]. Runtime adapters are registered for filesystem, GitHub, Git, web, and transcript material [@adapters].

The concepts are in [[concepts-source-material]], exact syntax is in [[source-address-syntax-reference]], and extension steps are in [[add-a-source-runtime-guide]].
