---
title: Add A Source Runtime Guide
topics: [guides, sources]
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
  - id: integrations
    type: file
    path: src/codealmanac/integrations/sources/__init__.py
---

# Add A Source Runtime Guide

Use this guide when adding a new source family or runtime adapter. The result should extend [[source-resolution-and-runtimes]] without adding source-specific branches to lifecycle workflows.

## Steps

1. Add or reuse a `SourceKind` and `SourceProvenanceKind` in the source models if the existing kinds do not fit [@models].
2. Add address parsing in a source-family module and keep `address_resolution.py` as a small dispatcher [@resolver].
3. Implement a `SourceRuntimeAdapter` in `integrations/sources/<family>/` with `supports()` and `inspect()` [@service].
4. Register the adapter in `default_source_runtime_adapters()` [@integrations].
5. Render bounded, prompt-facing text; do not leak raw external payloads downstream unless they are deliberate opaque evidence.

## Verification

Add service tests for address resolution and adapter tests for available, skipped, unavailable, and bounded-content cases. Update [[source-address-syntax-reference]] when syntax changes.
