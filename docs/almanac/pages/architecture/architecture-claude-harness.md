---
page_id: architecture-claude-harness
title: Claude Harness
summary: The Claude harness runs lifecycle work through `claude-agent-sdk` and maps SDK messages into normalized harness events.
topics: [architecture, integration, lifecycle]
sources:
  - id: claude-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
  - id: claude-client
    type: file
    path: src/codealmanac/integrations/harnesses/claude/client.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Claude Harness

The Claude harness runs lifecycle work through `claude-agent-sdk`. It checks readiness with `claude auth status`, falls back to `ANTHROPIC_API_KEY` readiness when appropriate, snapshots Git status before and after the SDK run, and returns normalized changed files and harness events. [@claude-adapter] [@live-agreement]

## Why use the SDK?

The live agreement records that the default Python Claude harness uses `claude-agent-sdk`, not a one-shot CLI print path, because lifecycle execution needs typed SDK messages and rich normalized events. [@live-agreement]

## What is isolated during a run?

Claude SDK runs use isolated settings, strict MCP configuration, no MCP servers, and noninteractive permission mode. [@live-agreement] [@claude-client]

## What should I read next?

Read `[[architecture-harness-system]]` and `[[reference-harness-events]]`.

