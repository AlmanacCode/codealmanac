---
page_id: reference-run-events
title: Run Events
summary: This page describes log events recorded during lifecycle runs.
topics: [reference, lifecycle]
sources:
  - id: runs-models
    type: file
    path: src/codealmanac/services/runs/models.py
  - id: page-run
    type: file
    path: src/codealmanac/workflows/page_run/service.py
---

# Run Events

Run events are append-only log rows attached to lifecycle runs. Page runs record ordinary messages, errors, and normalized harness events so users can inspect source resolution, provider output, safety failures, and terminal status. [@runs-models] [@page-run]

## Event payloads

Run log events include a readable message and may include a nested `harness_event` payload. [@runs-models]

## Where events come from

`PageRunWorkflow` records preflight messages, harness transcripts, normalized harness events, and failure summaries. [@page-run]

## Related pages

Use `[[reference-harness-events]]` for the nested provider-neutral event model.

