---
page_id: architecture
title: Architecture
topics: [architecture]
sources:
  - id: legacy-lifecycle
    type: wiki
    slug: lifecycle-architecture
    note: Existing legacy hub for operations, CLI routing, providers, jobs, and automation.
  - id: manual-page-selection
    type: file
    path: docs/almanac/_manual/page-selection.md
    note: Defines architecture pages as subsystem, flow, storage, and boundary documentation.
---

# Architecture

`architecture/` explains how CodeAlmanac works: subsystems, runtime flows,
storage, provider boundaries, command wiring, and integration shape.

The detailed architecture corpus is still mostly in legacy pages such as
[[lifecycle-architecture]], [[wiki-lifecycle-operations]], [[sqlite-indexer]],
[[harness-providers]], and [[source-provenance]]. Migrate those subjects here
when touching them. [@legacy-lifecycle]
