# Claude Agent SDK — Implementation Reference

Research compiled for slices 4 (bootstrap) and 5 (capture). Read this before implementing anything that touches `@anthropic-ai/claude-agent-sdk`. Cross-references to the OpenAlmanac GUI's production implementation for anything ambiguous.

## 1. Package + setup

**Package:** `@anthropic-ai/claude-agent-sdk`
**Current stable:** `^0.2.101` (as of April 2026) — pin exactly or use caret range
**Node.js:** 18+ minimum (we target 20+ already)
**Format:** ESM-only, works with `tsup --format esm`
**No native/binary deps** — safe to bundle, but mark as external in `tsup.config.ts` anyway to avoid bundling the SDK itself:

```typescript
// tsup.config.ts additions for slice 4
external: [
  "@anthropic-ai/claude-agent-sdk",
  "@anthropic-ai/sdk",
  "@modelcontextprotocol/sdk",
]
```

**Peer deps:**
- `@anthropic-ai/sdk` ^0.81.0 (types used directly)
- `@modelcontextprotocol/sdk` ^1.29.0 (for MCP; we won't use MCP in slices 4/5 but the SDK requires it)

## 2. Authentication — important

**Headless CLI auth reads `ANTHROPIC_API_KEY` from env.** The SDK does NOT pick up Claude Code's local auth store (`~/.claude/auth.json`) reliably in headless mode.

**Required behavior for `almanac bootstrap` / `almanac capture`:**
- Check `process.env.ANTHROPIC_API_KEY` before invoking `query()`
- If missing, exit with a clear error and link to how to set it:
  ```
  error: ANTHROPIC_API_KEY is required for almanac capture.
  export ANTHROPIC_API_KEY=sk-ant-...
  ```
- Do NOT attempt to auto-authenticate or open a browser

The SDK will throw mid-stream on auth failure, which is a poor UX. Gate upfront instead.

**Correction to earlier plan docs:** the slice 4/5 plans said "auth comes from Claude Code's existing auth store" — that was wrong. Update the plans accordingly.

## 3. The `query()` API

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const q = query({
  prompt: string | AsyncIterable<SDKUserMessage>,   // single string = one-shot; AsyncIterable = multi-turn
  options: {
    model?: string;                                 // FULL name: "claude-sonnet-4-6", "claude-opus-4-6"
    systemPrompt?: string | { type: "preset"; preset: string; append?: string };
    allowedTools?: string[];                        // "Read", "Write", "Agent", "mcp__server__tool"
    disallowedTools?: string[];
    agents?: Record<string, AgentDefinition>;       // subagent configs
    maxTurns?: number;                              // default ~100
    maxCostUsd?: number;                            // hard stop on cost
    cwd?: string;                                   // working directory for tools
    mcpServers?: Record<string, McpServerConfig>;   // unused in slices 4/5
    resume?: string;                                // resume by session_id
    includePartialMessages?: boolean;               // REQUIRED for streaming text deltas — default false
    permissionMode?: "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk" | "auto";
  },
});

// q is an AsyncGenerator<SDKMessage>
for await (const msg of q) { ... }
```

**Gotchas:**
- `includePartialMessages: true` is needed to get `stream_event` messages with text deltas. Without it, no streaming text — just completed assistant messages.
- Model name uses **full form** in `options.model` (`claude-sonnet-4-6`) but subagent `AgentDefinition.model` accepts short form (`sonnet`). Easy to flip.
- `maxTurns` is a hard stop — no graceful wrap-up turn. Set generously (100+).

## 4. `AgentDefinition`

```typescript
interface AgentDefinition {
  description: string;          // short explainer (shown in UI/traces)
  prompt: string;               // system prompt for the subagent
  tools?: string[];             // tool allowlist — subset of parent's tools
  model?: string;               // optional override: "sonnet" | "opus" | "haiku" (short form)
  maxTurns?: number;            // optional per-subagent turn cap
}
```

**Tool name format:**
- Built-ins: `"Read"`, `"Write"`, `"Edit"`, `"Glob"`, `"Grep"`, `"Bash"`, `"WebSearch"`, `"WebFetch"`, `"Agent"`
- MCP: `"mcp__<server>__<tool>"`

**Tool scoping is enforced by the SDK.** If a subagent is declared with `tools: ["Read", "Grep"]`, the SDK denies any Write/Edit attempts. This is how we enforce "reviewer is read-only."

## 5. Message types in the stream

```typescript
type SDKMessage =
  | { type: "assistant"; message: { content: ContentBlock[]; session_id?: string } }
  | { type: "stream_event"; event: { type: "content_block_delta"; delta: { type: "text_delta"; text: string } } }
  | { type: "user"; message: { content: ToolResultBlock[] } }
  | { type: "tool_use_summary"; summary: string }
  | { type: "result"; session_id?: string; subtype: "success" | "error"; result: string; total_cost_usd: number; num_turns: number }
  | { type: "system"; subtype: "status"; status: string };

interface ContentBlock {
  type: "text";
  text: string;
} | {
  type: "tool_use";
  id: string;                   // unique tool call ID
  name: string;                 // "Read", "Agent", "mcp__..."
  input: Record<string, unknown> | string;  // CAN be either — check before access
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown;
  is_error?: boolean;
}
```

**Key invariants:**
- `result` message is emitted exactly once at end — carries `total_cost_usd` and `num_turns`
- `session_id` appears first on an `assistant` message or on `result` — capture it once
- Tool results come through as a `user` message (yes, counterintuitive) with `tool_result` content blocks
- `tool_use.input` can be string-encoded JSON OR an object — **always type-check before access**

## 6. Subagent invocation — how it actually works

Writer invokes reviewer via the `Agent` tool. SDK routes internally:

```
Writer assistant message:
  content: [{
    type: "tool_use",
    name: "Agent",
    id: "tool_abc",
    input: {
      subagent_type: "reviewer",
      description: "Review my draft on JWT decisions",
      prompt: "Read pages/jwt-vs-sessions.md and critique..."
    }
  }]

[SDK spawns reviewer with its AgentDefinition, cwd, restricted tools]

User message (back to writer):
  content: [{
    type: "tool_result",
    tool_use_id: "tool_abc",
    content: "<reviewer's full text output>"
  }]

Writer continues, reads the feedback, decides what to do.
```

**Crucial properties:**
- Subagent gets a **fresh session context** — no shared conversation history with parent
- Subagent sees the **same `cwd`** as parent (filesystem is shared)
- Tool restrictions on subagent are enforced by SDK — reviewer can't Write even if its prompt tries
- **Subagents cannot invoke other subagents** (one level deep)
- Agent tool result is a **string** (the subagent's textual output) — parent must re-Read any files the subagent modified

## 7. Streaming output format

Target UX:

```
[bootstrap] reading package.json
[bootstrap] reading CLAUDE.md
[bootstrap] identified anchors: Next.js, Supabase, Stripe
[bootstrap] writing .almanac/pages/nextjs.md
[bootstrap] writing .almanac/pages/supabase.md
[done] 3 pages, cost: $0.02, turns: 14
```

Pseudo-code for the formatter:

```typescript
let currentAgent = "bootstrap";  // or "writer" / "reviewer"

for await (const msg of q) {
  if (msg.type === "assistant") {
    for (const block of msg.message.content) {
      if (block.type === "tool_use") {
        if (block.name === "Agent") {
          const input = typeof block.input === "string" ? JSON.parse(block.input) : block.input;
          currentAgent = input.subagent_type ?? "subagent";
          console.log(`\n[${currentAgent}] starting`);
        } else {
          console.log(`[${currentAgent}] ${formatTool(block.name, block.input)}`);
        }
      }
    }
  } else if (msg.type === "result") {
    const status = msg.subtype === "success" ? "done" : "failed";
    console.log(`[${status}] cost: $${msg.total_cost_usd.toFixed(3)}, turns: ${msg.num_turns}`);
  }
}
```

`formatTool(name, input)` should produce something like `reading src/auth/jwt.ts` or `writing .almanac/pages/auth.md`. Keep it one line per tool use.

Full raw stream goes to `.almanac/.capture-<session>.log`.

`--quiet` mode: suppress all stream output; only print the final `[done]` line.

## 8. Cost + usage

- Only `result` message carries cost (`total_cost_usd: number` in USD)
- No per-turn cost breakdown
- No token breakdown exposed (input/output/cache) — just USD
- Accumulate by reading the final `result`; no need to sum anything

## 9. Errors

`query()` throws on:
- **Auth missing/invalid** — before stream starts (check upfront, don't rely on this)
- **Network error** — mid-stream as a thrown exception
- **Invalid options** — malformed `agents`, unknown tool name
- **Model not found**
- **Rate limit** — after SDK's internal retries, surfaces as thrown error

Wrap the `for await` in a try/catch. Exit 1 with the error message.

**Subagent errors:** do NOT kill the parent. They surface as tool results with `is_error: true`. The writer can decide to retry or give up.

**Interrupt/cancel:** `q.interrupt()` returns a promise that waits for cleanup. Useful for SIGINT handling in the CLI.

## 10. Minimal slice 4 example

```typescript
// src/agent/sdk.ts
import { query, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

export interface RunAgentOptions {
  systemPrompt: string;
  prompt: string;
  allowedTools: string[];
  agents?: Record<string, AgentDefinition>;
  cwd: string;
  model?: string;
  onMessage?: (msg: unknown) => void;
}

export async function runAgent(opts: RunAgentOptions): Promise<{ cost: number; turns: number; result: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  const q = query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.systemPrompt,
      allowedTools: opts.allowedTools,
      agents: opts.agents ?? {},
      cwd: opts.cwd,
      model: opts.model ?? "claude-sonnet-4-6",
      maxTurns: 100,
      includePartialMessages: true,
    },
  });

  let cost = 0;
  let turns = 0;
  let result = "";

  for await (const msg of q) {
    opts.onMessage?.(msg);
    if (msg.type === "result") {
      cost = msg.total_cost_usd ?? 0;
      turns = msg.num_turns ?? 0;
      result = msg.result ?? "";
    }
  }

  return { cost, turns, result };
}
```

## 11. Slice 5 subagent definition

```typescript
// src/agent/subagents.ts
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

export function buildReviewerSubagent(reviewerPrompt: string): AgentDefinition {
  return {
    description:
      "Reviews proposed wiki changes against the full knowledge base for " +
      "cohesion, duplication, missing links, notability, and writing conventions.",
    prompt: reviewerPrompt,
    tools: ["Read", "Grep", "Glob", "Bash"],   // no Write/Edit/Agent — read-only
    // model: "sonnet",  // default; only override if needed
  };
}
```

## 12. Pitfalls the docs don't emphasize

1. **`includePartialMessages: true` is required for streaming text deltas.** Without it, no progress visibility during long turns.
2. **`tool_use.input` type varies** — sometimes string (JSON-encoded), sometimes object. Always type-check before access.
3. **Model naming inconsistency** — `options.model` uses full name (`claude-sonnet-4-6`), `AgentDefinition.model` uses short (`sonnet`). Flip-prone.
4. **Session ID capture timing** — appears on first `assistant` or final `result`. Capture on whichever comes first, don't assume one.
5. **`maxTurns` is a hard stop.** No wrap-up. Set to 100 for bootstrap, 150 for capture.
6. **Subagents inherit `cwd` and filesystem.** Tool restrictions are the only boundary between writer and reviewer — no sandboxing.
7. **Agent tool result is a string.** If subagent wrote files, parent must re-Read them. The tool result is the subagent's text output, not file contents.
8. **Some SDK versions' types are imprecise** — expect to cast or narrow message types with `if (msg.type === "X")` gates.
9. **Interrupting cleanly:** use `q.interrupt()` in a SIGINT handler. Don't just `process.exit(0)` mid-stream.
10. **Resume:** `resume: "sess_..."` requires a valid session_id from a prior run. Capture + persist if you want to support resume.

## 13. GUI reference paths (canonical implementation)

- `/Users/rohan/Desktop/Projects/openalmanac/gui/process-manager.js` — `_startProcess()` + `_iterateProcess()` show the full lifecycle
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/conversation.js` — multi-turn session pattern
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/agent-definitions.js` — `AgentDefinition` shape examples
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/normalize-messages.js` — SDK → app-level message conversion
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/async-channel.js` — `AsyncIterable` pattern for persistent multi-turn (slice 5 doesn't need this — one-shot capture)

## 14. What to copy vs. what to ignore from the GUI

**Copy:**
- `query()` + async generator iteration
- Message normalization switch statement
- Deferred finalization (capture the `result` message, but don't transition state until the generator is fully exhausted — some SDK versions emit additional messages after `result`)
- Session ID capture on first assistant message

**Ignore:**
- ProcessManager concurrency control (we're CLI one-shot)
- IPC messaging (Electron-specific)
- `permissionMode` switching (for interactive use)
- Slug-locking, artifact tracking, persistence (overkill for our CLI)
- `canUseTool` callback (custom tool validation — we use `tools` allowlist instead)
- `createAsyncChannel()` for persistent multi-turn — slice 4 and 5 are both one-shot

## Implementation checklist

- [ ] `npm install @anthropic-ai/claude-agent-sdk@^0.2.101`
- [ ] Add `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/sdk`, `@modelcontextprotocol/sdk` to `tsup.config.ts` externals
- [ ] `src/agent/sdk.ts` wrapper (see section 10)
- [ ] `src/agent/prompts.ts` loader (bundled prompts in `prompts/`)
- [ ] Auth gate: fail fast if `ANTHROPIC_API_KEY` missing
- [ ] Streaming formatter (one-line-per-tool-use, track `currentAgent` for subagent delegation)
- [ ] `--quiet` mode: suppress stream, show final cost line only
- [ ] Capture `result.total_cost_usd` + `num_turns` + `session_id`
- [ ] Full transcript to `.almanac/.capture-<session>.log`
- [ ] `try/catch` around the `for await` loop, clean exit code
- [ ] Slice 5 adds `agents: { reviewer }` to options + `Agent` to `allowedTools`
