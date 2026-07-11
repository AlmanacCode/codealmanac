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
  - id: transcript_adapters
    type: file
    path: src/codealmanac/integrations/sources/transcripts/__init__.py
    note: Default transcript discovery and runtime adapter registration.
  - id: codex_transcripts
    type: file
    path: src/codealmanac/integrations/sources/transcripts/codex.py
    note: Codex transcript discovery path and metadata parsing.
  - id: claude_transcripts
    type: file
    path: src/codealmanac/integrations/sources/transcripts/claude.py
    note: Claude transcript discovery path and metadata parsing.
  - id: sync_evaluation
    type: file
    path: src/codealmanac/workflows/sync/evaluation.py
    note: Sync transcript selection, repository matching, and inactive filtering.
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

## Transcript Discovery

Transcript discovery is a separate source path used by sync. The default discovery set has two adapters: Claude and Codex [@transcript_adapters]. The source model has the same two transcript app values, `claude` and `codex`, so there is no separate app identity for Codex app, Claude Desktop, Claude web, or editor-specific surfaces [@source_models].

The Codex adapter scans `.codex/sessions` under the configured home directory, reads the first JSONL lines for session metadata, and skips transcripts whose metadata marks `thread_source` as `subagent` [@codex_transcripts]. The Claude adapter scans `.claude/projects` under the configured home directory and skips paths that contain `subagents` [@claude_transcripts].

Sync does not ingest every discovered transcript. It matches each transcript `cwd` to a registered repository root, skips unregistered working directories, and skips transcripts older than the active sync window as `inactive` [@sync_evaluation]. That means a transcript can be discovered correctly but still not become ingest input for the current sync run.

## Related Reference

Accepted input forms are summarized in [Source Addresses](../../reference/sources/source-addresses). Page evidence uses a different contract, [Frontmatter And Sources](../../reference/page-format/frontmatter-and-sources).
