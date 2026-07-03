---
page_id: concept-source
title: Source
summary: A source is material that an ingest run resolves, inspects, and passes to the page-writing harness.
topics: [concepts, lifecycle]
sources:
  - id: sources-service
    type: file
    path: src/codealmanac/services/sources/service.py
  - id: sources-models
    type: file
    path: src/codealmanac/services/sources/models.py
  - id: ingest-service
    type: file
    path: src/codealmanac/workflows/ingest/service.py
---

# Source

A source is an input to `ingest`, such as a file, directory, Git range, GitHub issue, GitHub pull request, web URL, or transcript. The source service resolves raw input strings into source references and asks runtime adapters to produce snapshots that the ingest prompt can cite. [@sources-service] [@sources-models] [@ingest-service]

## Why does ingest inspect sources?

The harness should write from real evidence, not from a bare string. Runtime snapshots give the prompt concrete context about the source before the harness edits wiki pages. [@ingest-service]

## What happens when no adapter supports a source?

The source service returns a skipped runtime snapshot titled with the unsupported source identity. [@sources-service]

## What explains source behavior in detail?

Read `[[architecture-source-system]]` and `[[architecture-source-adapters]]`.

