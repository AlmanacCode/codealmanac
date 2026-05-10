---
title: Harness Providers
topics: [agents, stack, systems]
files:
  - src/harness/types.ts
  - src/harness/events.ts
  - src/harness/tools.ts
  - src/harness/providers/index.ts
  - src/harness/providers/metadata.ts
  - src/harness/providers/claude.ts
  - src/harness/providers/codex.ts
  - src/harness/providers/cursor.ts
---

# Harness Providers

The V1 harness layer is CodeAlmanac's provider-neutral execution boundary. Operations build one `AgentRunSpec`; provider adapters translate that spec to Claude, Codex, Cursor, or future runtimes and emit normalized `HarnessEvent` records for [[process-manager-runs]].

## Provider-neutral contract

`AgentRunSpec` contains provider selection, `cwd`, optional system prompt, assembled prompt, base tool requests, optional helper agent specs, optional skills/MCP config, limits, output schema, and operation metadata. Provider-neutral files must not import Claude, Codex, or Cursor SDK types.

`HarnessEvent` normalizes stream output into text, tool use, tool result, tool summary, context usage, error, and done events. Tool events can carry structured display details such as kind, title, path, command, status, exit code, and duration; foreground output and `jobs attach` use those fields to show activity like "Reading file" or "Running command" instead of only provider-specific tool names. Run summaries preserve provider session id, cost, turns, and usage only when the adapter can actually supply them.

## Adapters

The Claude adapter maps base tools to Claude Agent SDK tools, passes `tools` and `allowedTools`, sets `permissionMode: "dontAsk"`, supports programmatic per-run subagents, and reports cost/usage when available. Claude-specific auth and capability flags are documented in [[claude-agent-sdk]].

The Codex adapter uses `codex app-server --listen stdio://`, starts an ephemeral thread, sends one turn, and maps app-server notifications into `HarnessEvent`. It supports model override, reasoning effort, structured output schema, usage, and structured command/file/tool display details. The turn runs with `workspaceWrite` filesystem access and `networkAccess: false` by default. Server-initiated approval or user-input requests are answered noninteractively with denial or empty answers so lifecycle commands do not block.

The older `codex exec --json` helpers remain in the file as compatibility and failure-parsing utilities, but the default V1 run path is app-server.

Cursor remains an explicit placeholder provider in V1. It is present in metadata as the future extension point, but runs fail clearly until a real adapter lands.

## Capability rule

Provider metadata describes the adapter implemented here, not the provider ecosystem in general. If an adapter cannot enforce or map a field, it should reject it or mark the capability false instead of pretending the operation layer got the requested behavior.
