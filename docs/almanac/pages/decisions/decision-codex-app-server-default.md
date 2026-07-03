---
page_id: decision-codex-app-server-default
title: Codex App Server Default
summary: Codex app-server is the default Codex lifecycle path for the Python rewrite.
topics: [decisions, integration, lifecycle]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: codex-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/codex/adapter.py
---

# Codex App Server Default

Codex app-server is the default Codex lifecycle path. The adapter checks readiness with `codex login status`, runs through app-server, snapshots Git status before and after execution, and returns changed files in the harness result. [@live-agreement] [@codex-adapter]

## Status

Accepted. [@live-agreement]

## Context

The lifecycle path needs rich normalized events, noninteractive request handling, sandbox policy, usage parsing, and root-turn completion. [@live-agreement]

## Decision

We will use `codex app-server --listen stdio://` for Codex lifecycle execution instead of `codex exec`. [@live-agreement]

## Consequences

Codex provider logic is split into app-server transport, state, event mapping, responses, sandboxing, turn completion, usage, and result projection helpers. See `[[architecture-codex-harness]]`.

