---
page_id: decision-claude-sdk-harness
title: Claude SDK Harness
summary: Claude lifecycle execution uses `claude-agent-sdk` so CodeAlmanac can map typed SDK messages into normalized events.
topics: [decisions, integration, lifecycle]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: claude-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
---

# Claude SDK Harness

Claude lifecycle execution uses `claude-agent-sdk`, not a one-shot CLI output path. The adapter checks `claude auth status`, supports `ANTHROPIC_API_KEY` readiness fallback, runs the SDK client, and reports changed files from Git status snapshots. [@live-agreement] [@claude-adapter]

## Status

Accepted. [@live-agreement]

## Context

The lifecycle system needs structured provider sessions, text, tool, usage, helper-agent, error, and done events. Typed SDK messages are a better boundary for that than scraping final text output. [@live-agreement]

## Decision

We will use the Claude Agent SDK for lifecycle execution. [@live-agreement]

## Consequences

Claude event mapping stays inside the Claude integration boundary, and the rest of the system consumes normalized harness results. See `[[architecture-claude-harness]]`.

