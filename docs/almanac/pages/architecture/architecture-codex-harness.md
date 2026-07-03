---
page_id: architecture-codex-harness
title: Codex Harness
summary: The Codex harness runs lifecycle work through `codex app-server` and maps app-server notifications into normalized harness events.
topics: [architecture, integration, lifecycle]
sources:
  - id: codex-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/codex/adapter.py
  - id: codex-app-server
    type: file
    path: src/codealmanac/integrations/harnesses/codex/app_server.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Codex Harness

The Codex harness is the default Python lifecycle harness. It checks readiness with `codex login status`, runs lifecycle turns through `codex app-server --listen stdio://`, snapshots Git status before and after execution, and reports changed files through the normalized harness result. [@codex-adapter] [@live-agreement]

## Why app-server instead of `codex exec`?

The live agreement records Codex app-server as the main lifecycle path because the product needs rich normalized events, noninteractive responses, sandbox policy, root-turn completion, helper-turn isolation, and usage parsing. [@live-agreement]

## Where does provider complexity live?

The adapter delegates process startup and JSON-RPC turn flow to app-server client modules, while event, actor, item, agent, result, sandbox, response, timeout, and completion helpers stay inside the Codex integration boundary. [@codex-app-server] [@live-agreement]

## What should I read next?

Read `[[architecture-harness-system]]` and `[[reference-harness-events]]`.

