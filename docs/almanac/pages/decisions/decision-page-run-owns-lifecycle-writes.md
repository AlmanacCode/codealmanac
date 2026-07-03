---
page_id: decision-page-run-owns-lifecycle-writes
title: Page Run Owns Lifecycle Writes
summary: Shared harness-backed write mechanics belong in `PageRunWorkflow`, not in individual operations.
topics: [decisions, lifecycle]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: page-run
    type: file
    path: src/codealmanac/workflows/page_run/service.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
---

# Page Run Owns Lifecycle Writes

`PageRunWorkflow` owns the shared mechanics of harness-backed wiki writes: running-state transition, mutation preflight, harness invocation, transcript and event recording, mutation validation, index refresh, terminal success, and failure recording. [@live-agreement] [@page-run]

## Status

Accepted. [@live-agreement]

## Context

Ingest and garden prepare different context and prompts, but both need the same safety and run plumbing. Duplicating those mechanics would make behavior drift between operations. [@ingest] [@garden]

## Decision

We will keep shared page-writing lifecycle execution in `PageRunWorkflow`. Operation workflows prepare operation-specific context and delegate execution. [@live-agreement]

## Consequences

New harness-backed operations should reuse `PageRunWorkflow` instead of calling harnesses directly. See `[[architecture-page-run-workflow]]`.

