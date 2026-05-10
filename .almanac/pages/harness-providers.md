---
title: Harness Providers
topics: [agents, stack, systems]
files:
  - src/harness/types.ts
  - src/harness/events.ts
  - src/harness/tools.ts
  - src/harness/providers/index.ts
  - src/harness/providers/metadata.ts
  - src/harness/providers/claude.ts
  - src/harness/providers/codex.ts
  - src/harness/providers/cursor.ts
  - test/codex-harness-provider.test.ts
---

# Harness Providers

The V1 harness layer is CodeAlmanac's provider-neutral execution boundary. Operations build one `AgentRunSpec`; provider adapters translate that spec to Claude, Codex, Cursor, or future runtimes and emit normalized `HarnessEvent` records for [[process-manager-runs]].

## Provider-neutral contract

`AgentRunSpec` contains provider selection, `cwd`, optional system prompt, assembled prompt, base tool requests, optional helper agent specs, optional skills/MCP config, limits, output schema, and operation metadata. Provider-neutral files must not import Claude, Codex, or Cursor SDK types.

`HarnessEvent` normalizes stream output into text, tool use, tool result, tool summary, context usage, error, and done events. Tool events can carry structured display details such as kind, title, path, command, status, exit code, and duration; foreground output and `jobs attach` use those fields to show activity like "Reading file" or "Running command" instead of only provider-specific tool names. Run summaries preserve provider session id, cost, turns, and usage only when the adapter can actually supply them.

## Adapters

The Claude adapter maps base tools to Claude Agent SDK tools, passes `tools` and `allowedTools`, sets `permissionMode: "dontAsk"`, supports programmatic per-run subagents, and reports cost/usage when available. Claude-specific auth and capability flags are documented in [[claude-agent-sdk]].

The Codex adapter uses `codex app-server --config mcp_servers={} --listen stdio://` with a three-phase JSON-RPC handshake: `initialize` (sends `clientInfo` and `capabilities: { experimentalApi: true }`), then `thread/start` (sets `approvalPolicy: "never"`, `sandbox: "workspace-write"`, `ephemeral: true`, `developerInstructions` from the system prompt), then `turn/start` (sends the combined prompt as a single text input item with `sandboxPolicy: { type: "workspaceWrite", networkAccess: false }`). The `mcp_servers={}` override prevents user-level Codex MCP config from leaking tools into CodeAlmanac runs while preserving normal Codex auth. Each JSON-RPC handshake request has a 30-second timeout (default `CODEX_APP_SERVER_RPC_TIMEOUT_MS = 30_000`; overridable via env var `CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS` for testing), and each accepted turn has a terminal timeout (default 30 minutes; overridable via `CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS` for testing), so a stalled or incompatible app-server fails the run instead of leaving the process record stuck forever. The adapter streams notifications until `turn/completed` and then kills the child process. The environment always sets `CODEALMANAC_INTERNAL_SESSION=1` to let the subprocess identify itself as a background agent.

App-server notifications map to `HarnessEvent` as follows: `item/agentMessage/delta` → `text_delta`; `item/plan/delta` and `turn/plan/updated` → `tool_summary`; `item/started` and `item/completed` → `tool_use` / `tool_result` with structured display kind (shell, edit, mcp, web, agent, read, write); `item/commandExecution/outputDelta` and `item/fileChange/outputDelta` → `tool_summary`; `thread/tokenUsage/updated` → `context_usage` with usage parsed from `tokenUsage.last` (per-turn counts); `turn/completed` → terminal state; `error` notification → `error` event. The exec-path `parseCodexUsage` reads a flat token shape; the app-server path uses `parseCodexAppServerUsage`, which reads `tokenUsage.last.totalTokens` as the authoritative per-turn total, `tokenUsage.total.totalTokens` for cumulative processed tokens, and `tokenUsage.modelContextWindow` for `maxTokens` (the model's context window size).

Server-initiated requests are handled noninteractively so lifecycle commands never block. Known response patterns: `item/commandExecution/requestApproval` and `item/fileChange/requestApproval` → `{ decision: "decline" }`; legacy `execCommandApproval` / `applyPatchApproval` → `{ decision: "denied" }`; `item/tool/requestUserInput` → `{ answers: {} }`; `mcpServer/elicitation/request` → `{ action: "decline", content: null }`; `item/tool/call` → `{ contentItems: [], success: false }`; `item/permissions/requestApproval` → `{ permissions: {}, scope: "turn", strictAutoReview: true }` (empty permission grant); `account/chatgptAuthTokens/refresh` → JSON-RPC error `-32001` (CodeAlmanac does not manage ChatGPT auth tokens). Unrecognized server requests return JSON-RPC error `-32601`.

`warning` notifications are non-terminal: the adapter maps them to `tool_summary` events (`Warning: <message>`) so a config or model warning during a turn does not fail the run. `error` notifications read the message from `params.error.message`, `params.error.detail`, or `params.message` and classify the failure via `classifyCodexFailure`.

The adapter supports model override, reasoning effort, structured output schema (passed as `outputSchema` on the turn), and usage reporting. Per-run programmatic subagents, MCP, skills, and max-cost are unsupported and rejected at spec validation time. The older `codex exec --json` helpers remain in [[src/harness/providers/codex.ts]] as compatibility and failure-parsing utilities, but the default V1 run path is app-server.

Cursor remains an explicit placeholder provider in V1. It is present in metadata as the future extension point, but runs fail clearly until a real adapter lands.

## Test coverage

The Codex adapter has a unit test suite at `test/codex-harness-provider.test.ts` backed by an in-process fake app-server. The fake server covers command approval, permission requests, explicit ChatGPT token-refresh failure, structured tool display, warning notifications, nested error notifications, token usage, turn completion, silent app-server handshake timeout, and accepted-turn timeout. The fake server is permissive by design: it does not exercise a real Codex turn, configured MCP tool exposure, or future app-server protocol drift. End-to-end coverage requires a real Codex installation.

## Capability rule

Provider metadata describes the adapter implemented here, not the provider ecosystem in general. If an adapter cannot enforce or map a field, it should reject it or mark the capability false instead of pretending the operation layer got the requested behavior.
