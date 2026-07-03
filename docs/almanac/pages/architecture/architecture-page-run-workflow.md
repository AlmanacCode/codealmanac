---
page_id: architecture-page-run-workflow
title: Page Run Workflow
summary: PageRunWorkflow centralizes the shared mechanics for harness-backed wiki writes.
topics: [architecture, lifecycle]
sources:
  - id: page-run
    type: file
    path: src/codealmanac/workflows/page_run/service.py
  - id: lifecycle-mutation
    type: file
    path: src/codealmanac/workflows/lifecycle_mutation.py
  - id: lifecycle-harness
    type: file
    path: src/codealmanac/workflows/lifecycle_harness.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Page Run Workflow

`PageRunWorkflow` owns the shared lifecycle for harness-backed page writes. It resolves the workspace, marks the run running, performs mutation preflight, invokes the selected harness, records harness transcript and normalized events, validates changed files, refreshes the index, and finishes the run. [@page-run] [@live-agreement]

## Why is this separate from ingest and garden?

Ingest and garden have different prompts and context, but they need the same run, harness, mutation-safety, and index-refresh mechanics. Keeping those mechanics in one workflow prevents each operation from reimplementing the same safety rules. [@page-run] [@live-agreement]

## What protects the repository?

The mutation policy checks workspace state before the harness runs and validates the reported and actual changed files afterward. The harness helper validates terminal status and maps provider events to run event kinds. [@lifecycle-mutation] [@lifecycle-harness]

## What decision does this implement?

See `[[decision-page-run-owns-lifecycle-writes]]`.

This workflow is part of the broader lifecycle map in `[[architecture-lifecycle-workflows]]` and is constrained by `[[decision-git-mutation-safety]]`. [@page-run] [@lifecycle-mutation] [@lifecycle-harness] [@live-agreement]
