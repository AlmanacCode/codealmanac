---
title: Claude Agent SDK
topics: [stack, agents]
files:
  - src/harness/providers/claude.ts
  - src/harness/types.ts
  - src/harness/events.ts
  - src/agent/providers/claude/auth.ts
  - src/agent/prompts.ts
---

# Claude Agent SDK

`@anthropic-ai/claude-agent-sdk` is now used through the V1 Claude harness adapter, not through the deleted bootstrap/capture SDK wrapper. The repo keeps Claude-specific SDK types inside `src/harness/providers/claude.ts`; operation code only sees [[harness-providers]] types such as `AgentRunSpec`, `HarnessEvent`, and `HarnessResult`.

<!-- stub: fill in gotchas, model pinning details, and auth behavior as discovered -->

## Where we use it

- `src/harness/providers/claude.ts` — imports `query()` and maps `AgentRunSpec` to Claude SDK options.
- `src/agent/providers/claude/auth.ts` — checks installed/authenticated Claude CLI state for provider status.
- `src/agent/prompts.ts` — loads V1 operation prompts from the bundled `prompts/` directory.

## Adapter mapping

The adapter maps base tool requests to Claude tool names: read to `Read`, write to `Write`, edit to `Edit`, search to `Glob` and `Grep`, shell to `Bash`, and web to `WebSearch` and `WebFetch`. It passes the mapped list to both `tools` and `allowedTools`, sets `permissionMode: "dontAsk"`, sets `includePartialMessages: true`, and injects `CODEALMANAC_INTERNAL_SESSION=1`.

When `AgentRunSpec.agents` is present, the adapter maps each helper `AgentSpec` to a Claude `AgentDefinition` and ensures the main tool list includes `Agent`. V1 operations do not hardcode a reviewer agent; helper agents are generic harness data.

## Event normalization

Claude `SDKMessage` events are translated to `HarnessEvent` records. Text deltas, assistant text, tool uses, tool results, errors, and final result messages all flow through the same event hook used by [[process-manager-runs]]. Cost, turns, usage, and provider session id are preserved when the SDK exposes them.

## Auth

Two paths: Claude subscription OAuth via the Claude CLI credential store, or `ANTHROPIC_API_KEY`. The provider status path reports installed/authenticated state; lifecycle execution still fails at the adapter layer if the SDK cannot run. See [[sessionend-hook]] for headless capture behavior.

## Old wrapper removal

`src/agent/sdk.ts`, `src/commands/bootstrap.ts`, `src/commands/capture.ts`, and the `.bootstrap-*.log` / `.capture-*.log` flows were removed during the V1 cleanup. Do not reintroduce a command-specific Claude runner; add mapping behavior inside the provider adapter.
