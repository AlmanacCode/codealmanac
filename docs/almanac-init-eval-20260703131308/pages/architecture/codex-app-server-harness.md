---
title: Codex App-Server Harness
topics: [architecture, harnesses, codex]
sources:
  - id: adapter
    type: file
    path: src/codealmanac/integrations/harnesses/codex/adapter.py
  - id: app-server
    type: file
    path: src/codealmanac/integrations/harnesses/codex/app_server.py
  - id: responses
    type: file
    path: src/codealmanac/integrations/harnesses/codex/responses.py
  - id: tests
    type: file
    path: tests/test_codex_app_server_adapter.py
---

# Codex App-Server Harness

The Codex harness runs lifecycle prompts through `codex app-server --config mcp_servers={} --listen stdio://`, not `codex exec`. Readiness still uses `codex login status`, but execution goes through a JSON-RPC client with an ephemeral thread and root turn [@adapter] [@app-server].

The app-server client starts a thread with approval policy `never`, workspace-write sandboxing, and no network access in the turn sandbox policy [@app-server]. Server requests are answered noninteractively: approvals are declined, permission requests are denied or strict auto-reviewed, user input returns empty answers, and unsupported requests return structured errors [@responses].

Event mapping normalizes Codex notifications into [[concepts-normalized-harness-event]] rows, including tool displays, usage, warnings, root/helper actor attribution, and helper-agent lifecycle traces. The app-server tests assert the command arguments, sandbox policy, noninteractive responses, blank-delta filtering, and event mapping [@tests].
