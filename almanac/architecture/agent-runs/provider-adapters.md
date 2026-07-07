---
title: Provider Adapters
topics: [architecture, harnesses, providers, agent-runs]
sources:
  - id: codex-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/codex/adapter.py
  - id: codex-app-server
    type: file
    path: src/codealmanac/integrations/harnesses/codex/app_server.py
  - id: codex-events
    type: file
    path: src/codealmanac/integrations/harnesses/codex/events.py
  - id: codex-sandbox
    type: file
    path: src/codealmanac/integrations/harnesses/codex/sandbox.py
  - id: claude-adapter
    type: file
    path: src/codealmanac/integrations/harnesses/claude/adapter.py
  - id: claude-client
    type: file
    path: src/codealmanac/integrations/harnesses/claude/client.py
  - id: git-status
    type: file
    path: src/codealmanac/integrations/harnesses/git_status.py
  - id: codex-tests
    type: file
    path: tests/test_codex_app_server_adapter.py
  - id: claude-tests
    type: file
    path: tests/test_claude_adapter.py
---

# Provider Adapters

Provider adapters are the integration edge behind the [harness contract](harness-contract). They translate CodeAlmanac's normalized harness request into provider-specific execution, then translate provider output back into normalized results, events, transcripts, and changed-file reports. The current adapters are Codex through its app-server protocol and Claude through the Claude Agent SDK [@codex-adapter] [@claude-adapter].

This boundary keeps lifecycle workflows provider-neutral. Build, ingest, garden, queue workers, job logs, and mutation safety consume the same result shape no matter which provider ran the agent. Provider quirks stay in `integrations/harnesses/...`, which is also where readiness checks, auth fallback, timeout handling, event mapping, and sandbox options belong [@codex-app-server] [@claude-client].

## Shared Adapter Responsibilities

Both adapters implement the same service-owned contract: `check()` reports readiness and `run()` returns a `HarnessRunResult`. Both wrap provider execution with Git status snapshots before and after the run, then return absolute changed paths derived from the difference [@codex-adapter] [@claude-adapter] [@git-status].

Changed-file detection is intentionally outside the provider stream. Providers may report tool calls, edits, or summaries differently; Git status gives CodeAlmanac one local mechanism for deciding what changed. The parser handles porcelain `-z` output and treats rename or copy records as the new path [@git-status] [@claude-tests].

## Codex App-Server Adapter

The Codex adapter checks `codex login status`. Missing binaries, timeouts, and non-zero status results become `HarnessReadiness` values with repair text [@codex-adapter]. On run, it delegates to `CodexAppServerClient` and then attaches changed files [@codex-adapter].

`CodexAppServerClient` starts `codex app-server --config mcp_servers={} --listen stdio://`, initializes the JSON-RPC session, starts an ephemeral thread, and starts one turn with the rendered prompt [@codex-app-server]. It sets the approval policy to `never` and sends noninteractive responses to server approval or auth-token requests, so background lifecycle runs do not block on interactive provider prompts [@codex-app-server].

The Codex client reads app-server notifications until the root turn completes. It maps provider notifications into normalized harness events for text deltas, command output, plan updates, tool events, token usage, warnings, errors, and completion [@codex-events] [@codex-app-server]. Tests assert that provider session events, tool display data, usage fields, and root completion are mapped into the normalized event stream [@codex-tests].

Codex sandbox mode is resolved from an explicit value or `CODEALMANAC_CODEX_APP_SERVER_SANDBOX_MODE`. The supported modes are `danger-full-access` and `workspace-write`; workspace-write disables network access and constrains writable roots to the working directory [@codex-sandbox].

## Claude SDK Adapter

The Claude adapter checks `claude auth status`. If the CLI is unavailable, times out, returns malformed auth output, or reports a logged-out state, the adapter returns readiness with the appropriate repair hint. If `ANTHROPIC_API_KEY` is set, the adapter can report readiness even when CLI auth is not logged in [@claude-adapter].

Execution uses `ClaudeSdkClient`. The client calls the Claude Agent SDK query stream with a normalized prompt, cwd, model, strict empty MCP config, `permission_mode="dontAsk"`, partial messages enabled, and an allowed tool list of file, search, and shell tools [@claude-client]. It converts streamed SDK messages into harness events and appends a final done event [@claude-client].

Tests cover readiness, API-key fallback, Git changed-file detection, mapping SDK message streams into provider session, text, tool, helper-agent, usage, and done events, and handling SDK failures and timeouts [@claude-tests].

## Adding Providers

A new provider should be added by extending this adapter family, not by branching lifecycle workflows. The [add a harness provider adapter](../../guides/add-a-harness-provider-adapter) guide covers the mechanical path; architecturally, the provider must satisfy the same readiness, request, result, event, transcript, and changed-file contract.

Model choice is a separate configuration concern. The [controlled model catalog](../../decisions/controlled-model-catalog) decision explains why CodeAlmanac owns its supported runner and model configuration instead of discovering arbitrary provider models at runtime.
