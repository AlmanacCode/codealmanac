---
title: Source Resolution And Runtime
topics: [architecture, sources, ingest]
sources:
  - id: source_service
    type: file
    path: src/codealmanac/services/sources/service.py
    note: Source resolution, transcript discovery, and runtime inspection service.
  - id: address_resolution
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
    note: Dispatch from raw source strings to typed source briefs.
  - id: source_models
    type: file
    path: src/codealmanac/services/sources/models.py
    note: Source reference, brief, runtime, and transcript models.
  - id: ingest_workflow
    type: file
    path: src/codealmanac/workflows/ingest/service.py
    note: Ingest workflow use of source resolution and runtime inspection.
---

# Source Resolution And Runtime

Source resolution turns raw ingest inputs into typed source briefs. Runtime inspection then asks an adapter to load readable content for a source when CodeAlmanac has one available [@source_service]. The concept page is [Source Material](../../concepts/source-material); this page covers the service boundary that prepares material for ingest.

## Resolution

`SourcesService.resolve(...)` wraps each input string in `SourceAddress` and passes it to `resolve_address(...)` [@source_service]. The resolver recognizes GitHub shorthand, Git ranges, Git diffs, transcript references, HTTP and HTTPS URLs, and local paths [@address_resolution].

The resolved `SourceBrief` contains a `SourceRef`, title, provenance kind, and prompt hint [@source_models]. This gives lifecycle prompts typed source facts instead of raw strings.

## Runtime Inspection

Runtime inspection is adapter-based. `SourcesService.inspect_runtime(...)` asks each configured runtime adapter whether it supports the source reference and returns the first adapter result [@source_service]. If no adapter supports the source, the service returns a skipped runtime snapshot titled with the unsupported reference identity [@source_service].

Ingest uses this boundary before it renders the writing prompt. It resolves the requested inputs, records preparation events, inspects runtime snapshots, and passes both briefs and snapshots into the operation prompt [@ingest_workflow].

## Related Reference

Accepted input forms are summarized in [Source Addresses](../../reference/sources/source-addresses). Page evidence uses a different contract, [Frontmatter And Sources](../../reference/page-format/frontmatter-and-sources).
