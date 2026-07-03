---
page_id: concept-harness
title: Harness
summary: A harness is the provider adapter that runs an agent and returns normalized events, status, output, and changed files.
topics: [concepts, integration, lifecycle]
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

# Harness

A harness is the provider boundary that lets CodeAlmanac run a local agent while keeping the rest of the system provider-neutral. The harness service selects an adapter by kind, and normalized harness events can describe text, tool use, usage, provider sessions, failures, and helper-agent traces. [@harness-service] [@harness-events] [@live-agreement]

## Why normalize provider events?

Runs should expose one inspectable event stream even when Codex and Claude produce different raw messages. The Python rewrite treats the normalized stream as the product surface, not raw provider transcript files. [@live-agreement]

## Which harnesses exist now?

The current default harness set includes Codex app-server and Claude Agent SDK adapters. [@live-agreement]

## What should I read next?

Read `[[architecture-harness-system]]`, `[[architecture-codex-harness]]`, and `[[architecture-claude-harness]]`.

