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
  - id: setup-claude
    type: file
    path: src/codealmanac/integrations/setup/claude.py
    note: Claude agent instruction installation and import-line management.
  - id: setup-codex
    type: file
    path: src/codealmanac/integrations/setup/codex.py
    note: Codex AGENTS.md managed-block installation.
  - id: readme
    type: file
    path: README.md
    note: Public README documenting provider auth requirements.
---

# Providers

`HarnessesService` indexes adapters by provider kind and exposes provider-neutral `check` and `run` calls [@service]. Duplicate adapter kinds raise a conflict, so provider selection is explicit.

The Codex adapter checks `codex login status`, runs the Codex app-server client, and computes changed files from Git snapshots before and after execution [@codex-adapter]. The Codex client starts `codex app-server --listen stdio://`, creates an ephemeral thread, uses noninteractive approval policy, and maps notifications into normalized harness events [@codex-client].

The Claude adapter checks `claude auth status` and falls back to `ANTHROPIC_API_KEY` readiness when the CLI status path is unavailable or unauthenticated [@claude-adapter]. The Claude client uses `claude-agent-sdk` with explicit tools, empty MCP servers, `permission_mode="dontAsk"`, partial messages enabled, and normalized SDK event mapping [@claude-client].

Provider integrations live under `src/codealmanac/integrations/harnesses/`; product code talks to the harness service contract instead of raw provider payloads [@service].

## Auth Requirements

Read commands (`search`, `show`, `topics`, `health`, `validate`, `serve`) do not need provider credentials [@readme]. Write-capable lifecycle commands (`ingest`, `garden`, `sync`, `build`) need the selected harness to be available and authenticated before the run starts.

To authenticate and verify:

```bash
codex login
claude auth login
codealmanac doctor
```

## Agent Instruction Installation

`codealmanac setup` writes provider-specific instruction files so that Codex and Claude agents know how to work in a CodeAlmanac wiki before any run starts [@setup-claude] [@setup-codex].

For Codex, setup writes a managed block containing the agent guide into `~/.codex/AGENTS.md`. If `~/.codex/AGENTS.override.md` already exists and is non-empty, setup targets that file instead [@setup-codex].

For Claude, setup writes the agent guide to `~/.claude/codealmanac.md` and appends the line `@~/.claude/codealmanac.md` to `~/.claude/CLAUDE.md`, creating that file if it does not exist [@setup-claude].

`--target codex` or `--target claude` restricts installation to one provider. The default installs for both. `codealmanac uninstall` removes the managed blocks and guide files.
