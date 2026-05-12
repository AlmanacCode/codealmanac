---
title: Claude Agent SDK
topics: [stack, agents]
files:
  - src/harness/providers/claude.ts
  - src/harness/types.ts
  - src/harness/events.ts
  - src/agent/providers/claude/index.ts
  - src/agent/providers/claude/auth.ts
  - src/agent/prompts.ts
  - test/setup.test.ts
---

# Claude Agent SDK

`@anthropic-ai/claude-agent-sdk` is now used through the V1 Claude harness adapter, not through the deleted bootstrap/capture SDK wrapper. The repo keeps Claude-specific SDK types inside `src/harness/providers/claude.ts`; operation code only sees [[harness-providers]] types such as `AgentRunSpec`, `HarnessEvent`, and `HarnessResult`.

## Where we use it

- `src/harness/providers/claude.ts` — imports `query()` and maps `AgentRunSpec` to Claude SDK options.
- `src/agent/providers/claude/auth.ts` — checks installed/authenticated Claude CLI state for provider status.
- `src/agent/prompts.ts` — loads V1 operation prompts from the bundled `prompts/` directory.

## Adapter mapping

The adapter maps base tool requests to Claude tool names: read to `Read`, write to `Write`, edit to `Edit`, search to `Glob` and `Grep`, shell to `Bash`, and web to `WebSearch` and `WebFetch`. It passes the mapped list to both `tools` and `allowedTools`, sets `permissionMode: "dontAsk"`, sets `includePartialMessages: true`, and injects `CODEALMANAC_INTERNAL_SESSION=1`.

When `AgentRunSpec.agents` is present, the adapter maps each helper `AgentSpec` to a Claude `AgentDefinition` and ensures the main tool list includes `Agent`. V1 operations do not hardcode a reviewer agent; helper agents are generic harness data.

## Event normalization

Claude `SDKMessage` events are translated to `HarnessEvent` records. Text deltas, assistant text, tool uses, tool results, errors, and final result messages all flow through the same event hook used by [[process-manager-runs]]. Cost, turns, usage, and provider session id are preserved when the SDK exposes them.

## Model and limits

Default model is `claude-sonnet-4-6` (from `HARNESS_PROVIDER_METADATA.claude.defaultModel`). Per-run model override passes through `AgentRunSpec.provider.model`. Effort values `low`, `medium`, `high`, and `max` map directly to Claude SDK's `effort` option; any other value is dropped.

`maxTurns` defaults to `100` in `buildClaudeOptions`; operations currently override this to `150` via `AgentRunSpec.limits.maxTurns`. `maxBudgetUsd` maps to `limits.maxCostUsd` when present.

## Auth

Two paths: Claude subscription OAuth via the Claude CLI, or `ANTHROPIC_API_KEY`. Auth probe runs `claude auth status --json` with a 10-second timeout. On SDK 0.2.129+ the legacy `cli.js` probe is attempted as a fallback when the primary `claude` binary probe returns `loggedIn: false`. Any spawn error, timeout, non-JSON stdout, or non-zero exit with empty stdout returns `{ loggedIn: false }` rather than propagating an error. `ANTHROPIC_API_KEY` is accepted as the second gate — `assertClaudeAuth()` returns a synthetic `{ loggedIn: true, authMethod: "apiKey" }` when the key is set.

`resolveClaudeExecutable()` uses `command -v claude` to find the installed binary. The resolved path is passed as `pathToClaudeCodeExecutable` so the SDK and the auth probe agree on which binary to use. Headless auto-capture now runs through scheduler-backed [[capture-automation]] rather than app lifecycle hooks.

Provider setup tests can inject a fake `spawnCli` status probe instead of depending on a real `claude` binary on PATH. When `src/agent/providers/claude/index.ts` builds setup status with an injected probe, it treats Claude as installed and derives authentication from the injected status output or `ANTHROPIC_API_KEY`; production runtime discovery still uses `resolveClaudeExecutable()`. Keep this aligned with the Codex and Cursor setup-provider behavior so CI can exercise model override setup paths without installing every provider CLI.

## Capabilities

From `HARNESS_PROVIDER_METADATA.claude`: `sessionPersistence: true`, `threadResume: true`, `interrupt: true`, `mcp: true`, `skills: true`, `usage: true`, `cost: true`. `reasoningEffort: false` and `structuredOutput: false`. Subagents are supported with `programmaticPerRun: true` and `enforcedToolScopes: true`.

## Failure classification

`classifyClaudeFailure()` in `src/harness/providers/claude.ts` maps raw error strings to typed `HarnessFailure` codes:

- `claude.not_authenticated` — error contains "Not logged in" or "authentication"
- `claude.max_budget_exceeded` — subtype is `error_max_budget_usd`
- `claude.process_failed` (or `claude.<subtype>`) — all other cases

## Old wrapper removal

`src/agent/sdk.ts`, `src/commands/bootstrap.ts`, `src/commands/capture.ts`, and the `.bootstrap-*.log` / `.capture-*.log` flows were removed during the V1 cleanup. Do not reintroduce a command-specific Claude runner; add mapping behavior inside the provider adapter.
