---
title: Source Material
topics: [concepts, sources]
sources:
  - id: models
    type: file
    path: src/codealmanac/services/sources/models.py
  - id: resolution
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
---

# Source Material

Source material is raw evidence that a lifecycle run can inspect before deciding whether the wiki should change. The source layer turns user inputs into `SourceBrief` records, then asks a runtime adapter for bounded prompt-facing content [@models].

The model has four local layers: `SourceAddress`, `SourceRef`, `SourceBrief`, and `SourceRuntime`. The resolver dispatches address syntax to path, Git, GitHub, web, and transcript families [@resolution]. Exact syntax is in [[source-address-syntax-reference]].

`IngestWorkflow` resolves sources, records how many were resolved, loads runtime snapshots, and includes both briefs and runtime content in the operation prompt [@ingest]. The architecture is [[source-resolution-and-runtimes]].
