---
title: Normalized Harness Event
topics: [concepts, harnesses, runs]
sources:
  - id: events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: runs
    type: file
    path: src/codealmanac/services/runs/models.py
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Normalized Harness Event

A normalized harness event is CodeAlmanac's provider-neutral transcript row for agent execution. It can represent text, tool use, tool results, usage, provider sessions, warnings, errors, completion, and helper-agent traces [@events].

Run logs store these events inside `RunLogEvent.harness_event`, beside a readable run log kind and message [@runs]. This makes `jobs logs`, `jobs attach`, and the viewer inspect CodeAlmanac-owned event data instead of raw provider transcript files.

The provider adapters translate Codex and Claude streams into this model. See [[harness-service-contract]], [[codex-app-server-harness]], [[claude-sdk-harness]], and the exact [[harness-event-contract-reference]].
