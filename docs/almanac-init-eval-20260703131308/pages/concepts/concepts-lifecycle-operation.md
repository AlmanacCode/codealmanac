---
title: Lifecycle Operation
topics: [concepts, lifecycle]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: init
    type: file
    path: src/codealmanac/workflows/init/service.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
---

# Lifecycle Operation

A lifecycle operation is a page-writing CodeAlmanac workflow. In Python v1, `init`, `ingest`, and `garden` are the operation families that prepare prompts, run an agent harness, validate changed wiki files, refresh the index, and record a run [@init] [@ingest] [@garden].

This concept is deliberately narrow. Repo docs say only lifecycle operations invoke AI or write page prose; read commands may refresh derived index state, and organization commands may deterministically rewrite metadata such as topics [@manual].

The shared machinery is [[lifecycle-page-run-workflow]]. Operation-specific context is in [[init-ingest-garden-workflows]], and queued execution is in [[run-ledger-and-job-queue]].
