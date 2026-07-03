---
title: Claude SDK Harness
topics: [architecture, harnesses, claude]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
  - id: client
    type: file
    path: src/codealmanac/integrations/harnesses/claude/client.py
  - id: events
    type: file
    path: src/codealmanac/integrations/harnesses/claude/events.py
  - id: tests
    type: file
    path: tests/test_claude_adapter.py
---

# Claude SDK Harness

The Claude harness runs lifecycle prompts through `claude-agent-sdk`, while readiness probes `claude auth status` and can fall back to `ANTHROPIC_API_KEY` when the CLI is present but not logged in [@adapter].

The SDK client calls `query()` with options that isolate the run: no settings sources, strict MCP config, empty MCP servers, `permission_mode="dontAsk"`, allowed tools, partial messages, and the target working directory [@client]. Typed SDK messages are mapped into normalized events for text, stream deltas, tool use/results, usage, provider session, task/helper-agent events, warnings, errors, and done [@events].

The tests cover readiness modes, changed-file detection around SDK runs, and typed message mapping [@tests]. See [[harness-service-contract]] for the provider-neutral boundary.
