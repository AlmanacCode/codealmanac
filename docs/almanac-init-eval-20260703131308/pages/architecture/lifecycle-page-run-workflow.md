---
title: Lifecycle Page-Run Workflow
topics: [architecture, lifecycle, runs]
sources:
  - id: page-run
    type: file
    path: src/codealmanac/workflows/page_run/service.py
  - id: lifecycle
    type: file
    path: src/codealmanac/workflows/lifecycle.py
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Lifecycle Page-Run Workflow

`PageRunWorkflow` is the shared execution path for page-writing lifecycle operations. It resolves the workspace, marks the run running, performs mutation preflight, invokes the requested harness, records harness transcripts and normalized events, validates changed files, validates harness success, refreshes the index, and finishes the run [@page-run].

This shared path keeps operation workflows small. `init`, `ingest`, and `garden` prepare operation-specific context and prompts, then delegate run state, harness plumbing, mutation safety, and index refresh to page-run [@agreement].

The mutation and harness helper responsibilities are split behind lifecycle facades, so future operations should not duplicate safety checks in their own service files [@agreement]. Use [[add-a-lifecycle-operation-guide]] before adding an operation.
