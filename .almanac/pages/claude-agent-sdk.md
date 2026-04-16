---
title: Claude Agent SDK
topics: [stack, agents]
files:
  - src/agent/sdk.ts
  - src/agent/auth.ts
  - src/agent/prompts.ts
  - src/commands/bootstrap.ts
  - src/commands/capture.ts
---

# Claude Agent SDK

`@anthropic-ai/claude-agent-sdk` v0.2.x is the Anthropic-maintained TypeScript SDK used to run agentic loops in `bootstrap` and `capture`. The repo pins to `^0.2.110`. The SDK's primary export is `query()`, which drives a multi-turn conversation against a Claude model, executing tool calls and returning `SDKMessage` events.

<!-- stub: fill in gotchas, model pinning details, and auth behavior as discovered -->

## Where we use it

- `src/agent/sdk.ts` — the sole import site for the SDK. Every other module imports the `runAgent` wrapper from here rather than touching the SDK directly.
- `src/agent/auth.ts` — pre-flight auth gate; calls `claude auth status` via subprocess before the SDK generator starts.
- `src/agent/prompts.ts` — loads `prompts/*.md` from the npm package install path and passes them as system prompts.
- `src/commands/bootstrap.ts` — calls `runAgent` with `BOOTSTRAP_TOOLS = ["Read","Write","Edit","Glob","Grep","Bash"]`.
- `src/commands/capture.ts` — calls `runAgent` with the writer agent and passes a `{ reviewer: AgentDefinition }` subagent map.

## SDK wrapper design

`runAgent` in `src/agent/sdk.ts` sets defaults (model `claude-sonnet-4-6`, `maxTurns: 100`, `includePartialMessages: true`) and translates the SDK's stream into a `{cost, turns, success, error}` summary. It accepts an `onMessage` callback that both commands use to stream tool-use lines to stdout and write raw JSON to a `.bootstrap-*.log` / `.capture-*.log` file.

## Auth

Two paths: Claude subscription OAuth (reads `~/.claude/credentials/`) or `ANTHROPIC_API_KEY` env var. `assertClaudeAuth` checks `claude auth status` via a spawned subprocess; if neither credential is present it exits non-zero before the SDK generator starts. See [[sessionend-hook]] for how capture runs headlessly.

## Tool input quirk

`tool_use.input` from the SDK arrives as either a parsed object or a JSON-encoded string. `normalizeToolInput()` in `src/commands/bootstrap.ts` handles both forms before the formatter touches any field.
