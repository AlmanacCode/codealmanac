# Codex App-Server Provider Slice

Date: 2026-05-10

## Goal

Replace the current one-shot `codex exec --json` harness path with a managed
Codex app-server transport, while preserving Code Almanac's provider-neutral
`AgentRunSpec -> HarnessEvent -> process manager` boundary.

The user-facing goal is richer observability for foreground runs and
`almanac jobs attach`: tool/file/command activity should be visible as
structured events, not only as coarse text.

## Non-goals

- Do not copy T3 Code's full server architecture, Effect runtime, WebSocket UI,
  or persistence model.
- Do not add a hosted service.
- Do not change the public CLI surface.
- Do not implement long-lived multi-turn user chat. Each Code Almanac operation
  is still one managed run.
- Do not add Codex subagent support in this slice unless the protocol can be
  mapped cleanly without changing `AgentRunSpec`.

## Current State

`src/harness/providers/codex.ts` runs:

```text
codex exec --json --sandbox workspace-write --skip-git-repo-check -C <cwd> <prompt>
```

It parses stdout JSONL into the existing `HarnessEvent` union. This is good
enough for a simple one-shot job but weak for live inspection.

T3 Code uses `codex app-server` over JSON-RPC and receives richer notifications:

- `thread/started`
- `thread/status/changed`
- `thread/tokenUsage/updated`
- `turn/started`
- `turn/plan/updated`
- `turn/diff/updated`
- `item/started`
- `item/completed`
- `item/agentMessage/delta`
- `item/commandExecution/outputDelta`
- `turn/completed`

## Design

### 1. Keep the Harness Boundary

Do not change operation code. Build, Absorb, and Garden still produce
`AgentRunSpec`. The Codex provider adapter owns all Codex-specific process,
protocol, and event mapping behavior.

### 2. Add Structured Tool Details to `HarnessEvent`

Extend existing events rather than replacing them:

```ts
type ToolDisplayKind =
  | "read"
  | "write"
  | "edit"
  | "search"
  | "shell"
  | "mcp"
  | "web"
  | "agent"
  | "unknown";

interface HarnessToolDetails {
  kind?: ToolDisplayKind;
  title?: string;
  path?: string;
  command?: string;
  cwd?: string;
  status?: "started" | "completed" | "failed" | "declined";
  exitCode?: number | null;
  durationMs?: number | null;
  summary?: string;
  raw?: unknown;
}
```

Then add optional `display?: HarnessToolDetails` to `tool_use` and
`tool_result`.

Existing logs remain valid because this is additive. Foreground rendering can
show:

```text
[tool] Reading file .almanac/pages/foo.md
[tool] Running command almanac health
[tool] Editing file .almanac/pages/bar.md
```

### 3. App-Server Runtime

Create a small local runtime under `src/harness/providers/codex-app-server.ts`
or equivalent:

- spawn `codex app-server --listen stdio://`
- send JSON-RPC `initialize`
- send `thread/start` with:
  - `cwd`
  - `model`
  - `sandbox: "workspace-write"`
  - `approvalPolicy: "never"`
  - `baseInstructions` / `developerInstructions` from `systemPrompt` when useful
  - `ephemeral: true`
- send `turn/start` with one text input containing the combined prompt
- collect async notifications until `turn/completed`
- close/kill the child process

The runtime must manage:

- request ids and pending responses
- stdout line framing
- stderr capture
- child error/close handling
- timeout-free normal operation
- cleanup on completion or failure

### 4. Event Mapping

Map app-server notifications to the existing `HarnessEvent` model:

- `item/agentMessage/delta` -> `text_delta`
- `item/plan/delta` -> `tool_summary` or `text_delta` with a clear prefix
- `turn/plan/updated` -> `tool_summary`
- `item/started`:
  - commandExecution -> `tool_use` with `display.kind = "shell"`
  - fileChange -> `tool_use` with `display.kind = "edit"`
  - mcpToolCall -> `tool_use` with `display.kind = "mcp"`
  - dynamicToolCall -> `tool_use` with inferred kind/title
  - webSearch -> `tool_use` with `display.kind = "web"`
  - imageView -> `tool_use`
  - collabAgentToolCall -> `tool_use` with `display.kind = "agent"`
- `item/completed` -> matching `tool_result`
- `commandExecutionOutputDelta` -> `tool_summary` for now, preserving output
  without overwhelming foreground output
- `thread/tokenUsage/updated` -> `context_usage`
- `turn/completed` -> terminal `done` and final `HarnessResult`
- `error` / failed completed turn -> `error`

For command actions, infer readable labels:

- `read` -> "Reading file"
- `listFiles` -> "Listing files"
- `search` -> "Searching"
- unknown command -> "Running command"

### 5. Tests

Add or update tests around:

- JSON-RPC request/response correlation
- successful fake app-server run
- tool event mapping for command read/search/shell and file changes
- assistant deltas and final result
- malformed JSON or child exit classification
- foreground event formatting with structured display details
- provider metadata update for Codex streaming/session/interrupt capability if
  app-server becomes the default transport

### 6. Review Loop

After the first working implementation:

1. Run focused tests.
2. Commit and push.
3. Request a code-quality review subagent.
4. Fix must-fix and should-fix findings.
5. Re-run focused tests plus full `npm test`.
6. Commit and push review fixes.
7. Garden the wiki pages for Codex provider/process architecture if the code
   changed the durable design.

## Acceptance Criteria

- `almanac garden --foreground --using codex` uses app-server by default.
- Foreground runs show structured tool activity with useful labels/paths where
  available.
- `.almanac/runs/<id>.jsonl` contains structured tool details.
- Existing operations still work with Claude.
- Codex unsupported feature failures remain clear.
- Tests cover the app-server runtime without requiring real Codex auth.
- `npm test` passes before final push.
