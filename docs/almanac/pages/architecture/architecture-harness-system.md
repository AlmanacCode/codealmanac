---
page_id: architecture-harness-system
title: Harness System
summary: The harness system selects provider adapters and normalizes provider output into CodeAlmanac run events.
topics: [architecture, integration, lifecycle]
sources:
  - id: harness-service
    type: file
    path: src/codealmanac/services/harnesses/service.py
  - id: harness-events
    type: file
    path: src/codealmanac/services/harnesses/events.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Harness System

The harness system is the provider-neutral boundary around local agent execution. `HarnessesService` indexes adapters by kind, checks readiness, and runs the selected adapter; normalized harness events carry text, tools, usage, provider sessions, failure metadata, and helper-agent traces into the run log. [@harness-service] [@harness-events]

## Why is the service provider-neutral?

The rest of the lifecycle stack needs one contract for agent execution. Codex and Claude differ at the edge, but page-run execution needs only readiness, status, transcript references, changed files, summary, and events. [@live-agreement]

## What are the current provider edges?

`[[architecture-codex-harness]]` covers the Codex app-server adapter. `[[architecture-claude-harness]]` covers the Claude Agent SDK adapter.

## Where are event fields listed?

See `[[reference-harness-events]]`.

