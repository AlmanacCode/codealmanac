---
title: Sources Architecture
topics: [architecture, sources, ingest, overview]
sources:
  - id: topics
    type: file
    path: almanac/topics.yaml
    note: Topic graph entries for sources, ingest, lifecycle, evidence, and page format.
  - id: source-runtime
    type: wiki
    path: architecture/sources/source-resolution-and-runtime
    note: Architecture page for resolving raw ingest inputs and inspecting supported runtime sources.
  - id: source-material
    type: wiki
    path: concepts/source-material
    note: Concept page separating raw ingest material from page evidence.
  - id: source-addresses
    type: wiki
    path: reference/sources/source-addresses
    note: Reference page for accepted source address forms and resolver behavior.
  - id: source-adapter-guide
    type: wiki
    path: guides/add-a-source-runtime-adapter
    note: Guide for adding a source runtime adapter.
  - id: frontmatter-sources
    type: wiki
    path: reference/page-format/frontmatter-and-sources
    note: Reference page for page source entries and inline citations.
---

# Sources Architecture

Sources architecture is the boundary between material selected for ingest and
evidence written into wiki pages. The topic graph connects `sources` to
architecture and `ingest`, while page-format evidence is a separate
neighborhood; this split keeps raw inputs from being confused with durable
`sources:` entries [@topics] [@source-material] [@frontmatter-sources].

Read this hub when changing ingest input parsing, transcript discovery, runtime
inspection, source adapter support, or the page evidence contract.

## Reading Order

Start with [Source material](../../concepts/source-material). It defines raw
material as selected input for an ingest run and keeps that concept distinct
from the `sources:` evidence that supports finished wiki claims
[@source-material].

Then read [Source resolution and runtime](source-resolution-and-runtime). It
explains how raw input strings become typed source briefs, how runtime adapters
load readable snapshots when supported, and how sync discovers Claude and Codex
transcripts before queueing ingest work [@source-runtime].

Use [Source addresses](../../reference/sources/source-addresses) for exact
accepted address forms and resolver order [@source-addresses]. Use
[Frontmatter and sources](../../reference/page-format/frontmatter-and-sources)
when the change is about page evidence, file-source indexing, or inline
citations rather than ingest input loading [@frontmatter-sources].

## Change Path

[Add a source runtime adapter](../../guides/add-a-source-runtime-adapter) is the
task guide for extending runtime inspection [@source-adapter-guide]. Follow it
after the architecture page, because adapter work must preserve the same
distinction between selected raw material and cited page evidence.
