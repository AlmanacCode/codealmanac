---
page_id: decision-normalized-harness-events
title: Normalized Harness Events
summary: CodeAlmanac exposes provider-neutral harness events instead of raw Codex or Claude transcript files.
topics: [decisions, lifecycle, integration]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: run-models
    type: file
    path: src/codealmanac/services/runs/models.py
---

# Normalized Harness Events

CodeAlmanac treats normalized harness events as the inspectable transcript surface for lifecycle runs. Events can carry provider-neutral text, tool use, tool results, usage, provider session ids, failures, helper-agent traces, and raw payloads. [@live-agreement] [@harness-events]

## Status

Accepted. [@live-agreement]

## Context

Codex and Claude expose different raw event shapes. Users still need one readable job log and one service-owned event contract. [@live-agreement]

## Decision

We will normalize provider output into `HarnessEvent` and persist it alongside readable run log rows. [@harness-events] [@run-models]

## Consequences

Provider-specific parsing stays inside the provider adapter. Run logs and the viewer can consume one event model. See `[[architecture-harness-system]]` and `[[reference-harness-events]]`.

