---
title: Source Material
topics: [concepts, sources]
sources:
  - id: sources-service
    type: file
    path: src/codealmanac/services/sources/service.py
    note: Source resolution, transcript discovery, and runtime inspection service.
  - id: source-models
    type: file
    path: src/codealmanac/services/sources/models.py
    note: Source address, brief, kind, provenance, and runtime models.
  - id: address-resolution
    type: file
    path: src/codealmanac/services/sources/address_resolution.py
    note: Dispatch from raw source strings to typed source briefs.
  - id: sources-manual
    type: file
    path: src/codealmanac/manual/sources.md
    note: Manual guidance for treating sources as raw material.
  - id: frontmatter
    type: file
    path: src/codealmanac/services/wiki/frontmatter.py
    note: Page `sources:` frontmatter parsing.
---

# Source Material

Source material is the raw input selected for an ingest run. It can be a file, directory, Git diff, commit range, GitHub pull request or issue, URL, or local agent transcript; CodeAlmanac resolves that input into typed source briefs and, when possible, bounded runtime snapshots before the agent writes [@address-resolution] [@source-models] [@sources-service]. Source material is not automatically page evidence. It is material the operation may learn from.

The distinction matters because ingest is a synthesis operation, not a copying operation. The sources manual says selected material may include many forms of input, but adding or discovering material does not imply a wiki update [@sources-manual]. The run decides whether the material changes durable repo knowledge.

## From Address To Runtime Snapshot

An ingest request begins with raw input strings. `SourcesService.resolve(...)` turns each string into a `SourceBrief` by passing it through address resolution [@sources-service]. The resolver recognizes GitHub shorthand, Git ranges, Git diffs, transcript references, web URLs, and local paths [@address-resolution].

A source brief identifies the selected material and gives the prompt a provenance hint. Runtime inspection is a second step. `SourcesService.inspect_runtime(...)` asks the first adapter that supports the source reference to load readable content; when no adapter supports it, the service returns a skipped runtime snapshot [@sources-service].

## Source Material Versus Page Sources

Page `sources:` frontmatter is different. It records evidence for claims already written into a wiki page. The frontmatter parser accepts structured source entries with an `id`, `type`, and a target field such as `path`, `url`, `commit`, `pr`, `issue`, `run_id`, or `page` depending on the source type [@frontmatter].

That means a file can be both source material and page evidence, but it plays a different role in each place. As source material, it is input to an ingest run. As a `sources:` entry, it is a named citation target that supports a specific factual claim in the article.

## What The Agent Should Do With It

The ingest manual tells agents not to summarize files, sessions, docs, or conversations. They should distill reusable project meaning from the material [@sources-manual]. A transcript might reveal a durable decision. A diff might reveal an invariant. A file might support a page about a workflow. If the material adds no durable wiki knowledge, no-op is valid.

This is why source material belongs near the source-resolution architecture, while page evidence belongs near the page-format reference. The two concepts meet during ingest, but they should not be collapsed.

## Related Pages

The architecture path is [Source resolution and runtime](../architecture/sources/source-resolution-and-runtime). Exact accepted input forms belong in [Source addresses](../reference/sources/source-addresses). The page evidence format belongs in [Frontmatter and sources](../reference/page-format/frontmatter-and-sources).
