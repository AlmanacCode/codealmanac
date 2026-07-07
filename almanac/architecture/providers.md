---
title: Providers
summary: CodeAlmanac runs operation agents through provider-neutral harness adapters.
topics: [architecture, agents, operations]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/harnesses/service.py
    note: Provider-neutral harness service.
  - id: codex-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/codex/adapter.py
    note: Codex readiness and changed-file adapter.
  - id: codex-client
    type: file
    path: src/codealmanac/integrations/harnesses/codex/app_server.py
    note: Codex app-server JSON-RPC client.
  - id: claude-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
    note: Claude readiness and changed-file adapter.
  - id: claude-client
    type: file
    path: src/codealmanac/integrations/harnesses/claude/client.py
    note: Claude Agent SDK client.
---

# Providers

`HarnessesService` indexes adapters by provider kind and exposes provider-neutral `check` and `run` calls [@service]. Duplicate adapter kinds raise a conflict, so provider selection is explicit.

The Codex adapter checks `codex login status`, runs the Codex app-server client, and computes changed files from Git snapshots before and after execution [@codex-adapter]. The Codex client starts `codex app-server --listen stdio://`, creates an ephemeral thread, uses noninteractive approval policy, and maps notifications into normalized harness events [@codex-client].

The Claude adapter checks `claude auth status` and falls back to `ANTHROPIC_API_KEY` readiness when the CLI status path is unavailable or unauthenticated [@claude-adapter]. The Claude client uses `claude-agent-sdk` with explicit tools, empty MCP servers, `permission_mode="dontAsk"`, partial messages enabled, and normalized SDK event mapping [@claude-client].

Provider integrations live under `src/codealmanac/integrations/harnesses/`; product code talks to the harness service contract instead of raw provider payloads [@service].
