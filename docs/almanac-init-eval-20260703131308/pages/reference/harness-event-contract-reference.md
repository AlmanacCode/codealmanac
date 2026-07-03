---
title: Harness Event Contract Reference
topics: [reference, harnesses]
sources:
  - id: events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: results
    type: file
    path: src/codealmanac/services/harnesses/results.py
  - id: kinds
    type: file
    path: src/codealmanac/services/harnesses/kinds.py
---

# Harness Event Contract Reference

This page lists the normalized harness result and event fields used in run logs. [[harness-service-contract]] explains adapter ownership.

## Kinds And Status

Harness kinds are `codex` and `claude`. Run statuses are `succeeded`, `failed`, and `cancelled` [@kinds].

Event kinds are `text_delta`, `text`, `tool_use`, `tool_result`, `tool_summary`, `context_usage`, `provider_session`, `warning`, `error`, `done`, `agent_spawned`, `agent_wait_started`, and `agent_completed` [@events].

Tool display kinds are `read`, `write`, `edit`, `search`, `shell`, `mcp`, `web`, `agent`, `image`, and `unknown`; tool statuses are `started`, `completed`, `failed`, and `declined` [@events].

## Result

`HarnessRunResult` stores provider kind, terminal status, output text, optional summary, changed files, optional transcript ref, and normalized events [@results].
