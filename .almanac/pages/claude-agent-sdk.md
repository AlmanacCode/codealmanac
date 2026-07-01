---
title: Claude Agent SDK
summary: >-
  The Python Claude harness uses `claude-agent-sdk` behind the provider-neutral
  `HarnessAdapter` port and normalizes SDK messages into CodeAlmanac harness
  events.
topics:
  - stack
  - agents
  - provider-harness
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
    note: Service-facing Claude harness adapter and readiness probe.
  - id: client
    type: file
    path: src/codealmanac/integrations/harnesses/claude/client.py
    note: Claude Agent SDK execution client and SDK options.
  - id: events
    type: file
    path: src/codealmanac/integrations/harnesses/claude/events.py
    note: SDK message to normalized HarnessEvent mapping.
  - id: display
    type: file
    path: src/codealmanac/integrations/harnesses/claude/display.py
    note: Claude tool display normalization.
  - id: failures
    type: file
    path: src/codealmanac/integrations/harnesses/claude/failures.py
    note: Claude failure classification.
  - id: usage
    type: file
    path: src/codealmanac/integrations/harnesses/claude/usage.py
    note: Claude token usage mapping.
  - id: tests
    type: file
    path: tests/test_claude_adapter.py
    note: Fake SDK stream tests for the Claude harness.
  - id: archive
    type: file
    path: archive/code/src/harness/providers/claude.ts
    note: Archived TypeScript Claude SDK behavior reference.
verified: 2026-07-01
---

# Claude Agent SDK

The Python Claude harness uses the `claude-agent-sdk` package through
`[[src/codealmanac/integrations/harnesses/claude/client.py]]`. The service
boundary remains `[[src/codealmanac/services/harnesses/ports.py]]`: workflows
call `HarnessAdapter.run()` and receive a `HarnessRunResult`.

`[[src/codealmanac/integrations/harnesses/claude/adapter.py]]` owns the
service-facing adapter. It checks readiness with `claude auth status`, accepts
`ANTHROPIC_API_KEY` when the CLI exists but is not logged in, delegates run
execution to `ClaudeSdkClient`, and wraps the run with Git changed-file
snapshots.

`ClaudeSdkClient` builds `ClaudeAgentOptions` with `setting_sources=[]`,
`strict_mcp_config=True`, `mcp_servers={}`, `permission_mode="dontAsk"`,
`include_partial_messages=True`, and the local edit/search tool set:
`Read`, `Write`, `Edit`, `MultiEdit`, `Glob`, `Grep`, and `LS`. This keeps
CodeAlmanac lifecycle runs isolated from ambient Claude project settings and
MCP servers.

`[[src/codealmanac/integrations/harnesses/claude/events.py]]` maps typed SDK
dataclasses into normalized `HarnessEvent` records. It emits provider session,
text delta, assistant text, tool use, tool result, context usage, helper-agent,
error, and done events. Raw SDK payloads are attached only after conversion to
JSON-compatible values.

The helper-agent mapping follows the archived TypeScript behavior in
`[[archive/code/src/harness/providers/claude.ts]]`: an `Agent` tool use creates
an `agent_spawned` event, stores the tool-use id as the helper thread id, and
emits `agent_completed` when the matching tool result arrives.

`[[tests/test_claude_adapter.py]]` uses real `claude-agent-sdk` dataclasses and
a fake async query stream. The tests cover SDK option isolation, provider
session recording, text deltas, tool display, helper completion, usage, failure
classification, timeouts, `ANTHROPIC_API_KEY` readiness fallback, changed-file
wrapping, and default `create_app()` wiring.

The current slice did not run a paid real-Claude lifecycle dogfood. The release
risk is provider behavior under the live SDK/CLI process, not the service port
or normalized event model.
