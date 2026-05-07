# Agent Provider CLI Implementation Research

Date: 2026-05-07

Scope: implementation guidance for `codealmanac` agent providers, especially Claude, Codex CLI, and Cursor CLI. This note is research-only; no production code was changed.

## Sources Checked

- Local source of truth spec: `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`.
- codealmanac provider code: `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts`, `/Users/rohan/Desktop/Projects/codealmanac/src/agent/providers.ts`, `/Users/rohan/Desktop/Projects/codealmanac/src/update/config.ts`.
- OpenAlmanac GUI provider target: `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/`, `/Users/rohan/Desktop/Projects/openalmanac/gui/shared/providers/runtime-events.d.ts`.
- Almanac MCP search was available, but searches for provider implementation notes did not return useful matches.
- Official docs:
  - Anthropic Claude Agent SDK TypeScript reference: https://platform.claude.com/docs/en/agent-sdk/typescript
  - Claude Agent SDK streaming output: https://code.claude.com/docs/en/agent-sdk/streaming-output
  - OpenAI Codex CLI overview/reference: https://developers.openai.com/codex/cli, https://developers.openai.com/codex/cli/reference
  - OpenAI Codex non-interactive mode: https://developers.openai.com/codex/noninteractive
  - OpenAI Codex auth/security/subagents: https://developers.openai.com/codex/auth, https://developers.openai.com/codex/agent-approvals-security, https://developers.openai.com/codex/subagents
  - Cursor CLI docs: https://cursor.com/docs/cli/using, https://cursor.com/docs/cli/reference/parameters, https://cursor.com/docs/cli/reference/output-format
- Local CLI probes:
  - `claude --help`, `claude auth status --json`, `claude --version` -> `2.1.132 (Claude Code)`, authenticated via Claude subscription.
  - `codex --help`, `codex exec --help`, `codex login --help`, `codex --version`, `codex login status` -> `codex-cli 0.128.0`, logged in using ChatGPT.
  - `cursor-agent --help`, `cursor-agent status --help`, `cursor-agent --version` -> `2026.04.08-a41fba1`; `cursor-agent status` reported not logged in and then hung in the local probe, so the process was killed. Treat Cursor auth/status behavior as needing a clean logged-in probe.

## 1. What OpenAlmanac GUI Does For Providers

The GUI has a service/adapter/capabilities/event-contract pattern:

- `service.js` is the provider facade. It registers adapters by provider instance id, stores provider metadata, normalizes model selection, routes auth/login/logout/model validation, builds provider-specific options, and starts turns/sessions. See `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/service.js:13` for adapter registration, `:18` for metadata/capabilities, `:51` for model selection normalization, `:70`-`:99` for auth/login/logout routing, `:111`-`:144` for option construction and query start, and `:147`-`:202` for persistent session/warm-session orchestration.
- Each adapter owns provider details. Claude uses the Anthropic SDK (`query`, `getSessionMessages`), declares capabilities and valid models, validates model ids, builds `query()` options, and streams SDK messages. See `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/claude-adapter.js:24`-`:39` for metadata/capabilities, `:41`-`:79` for models, `:130`-`:154` for persistent/quick options, and `:170`-`:198` for background turns.
- The Codex GUI adapter intentionally uses the Codex app-server, not `codex exec`. It opens/resumes threads, starts turns, listens for app-server notifications, normalizes token usage, streams deltas/tool events, and emits a final `done`. See `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/codex-adapter.js:13`-`:32` for metadata/capabilities, `:89`-`:114` for context usage normalization, `:150`-`:162` for thread start/resume, `:183`-`:222` for notification-to-runtime-event mapping, `:257`-`:285` for final `done`, and `:328`-`:350` for app-server auth/model refresh.
- The runtime event contract is provider-neutral and in `shared`. It defines `text_delta`, `text`, `tool_use`, `tool_result`, `tool_summary`, `error`, `context_usage`, and `done`, with a final result/cost/turn/session shape. See `/Users/rohan/Desktop/Projects/openalmanac/gui/shared/providers/runtime-events.d.ts:1`-`:12` for the boundary rule and `:30`-`:91` for the event union.

Takeaway for codealmanac: copy the shape, not the size. codealmanac only has `bootstrap` and `capture` as AI-writing commands, no GUI persistent chat runtime, no warm sessions, no renderer state, and no provider login UI. It needs adapters plus metadata plus a small event/result normalization contract.

## 2. Correct Claude Path

Use the Anthropic `@anthropic-ai/claude-agent-sdk` TypeScript SDK, not shelling out to `claude -p`, for codealmanac's primary Claude provider.

Why:

- codealmanac already has a thin SDK wrapper in `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:111`-`:132`.
- The SDK exposes the exact features codealmanac needs: `cwd`, `model`, `maxTurns`, `systemPrompt`, `env`, `pathToClaudeCodeExecutable`, `includePartialMessages`, `agents`, `allowedTools`, `disallowedTools`, `canUseTool`, and result messages. Anthropic's TypeScript reference lists these options, including subagent definitions and partial streaming.
- The SDK result message gives reliable `total_cost_usd`, `num_turns`, success/error subtype, final `result`, and `session_id`; current codealmanac already normalizes those at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:155`-`:179`.

Auth readiness:

- Keep the current two-path auth gate: `claude auth status --json` for Claude subscription OAuth, fallback to `ANTHROPIC_API_KEY`. Current implementation is in `/Users/rohan/Desktop/Projects/codealmanac/src/agent/auth.ts`; provider status wraps it in `/Users/rohan/Desktop/Projects/codealmanac/src/agent/providers.ts:50`-`:69`.
- Local probe confirmed Claude Code `2.1.132` and `claude auth status --json` returned logged-in subscription auth. Do not depend on the old SDK-private `cli.js`; current code correctly treats it as a legacy fallback.

Model defaults:

- Current default is `claude-sonnet-4-6` in `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:12` and `/Users/rohan/Desktop/Projects/codealmanac/src/update/config.ts`.
- Keep a full model-id default for the SDK path. Local `claude --help` says CLI `--model` accepts aliases such as `sonnet` or full ids, but codealmanac's SDK wrapper should stay explicit.
- Optional future: expose `claude-opus-4-6` and `claude-sonnet-4-6` as known ids, mirroring the GUI adapter's selectable models at `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/claude-adapter.js:41`-`:44`.

Tool allowlist and subagents:

- Important nuance: current Anthropic docs say `allowedTools` auto-approves tools, while `disallowedTools` blocks tools. It is not a strict allowlist by itself. Therefore the codealmanac option/comment "Tool allowlist" is misleading if no `disallowedTools`/permission mode is also used.
- Correct implementation for strict behavior: pass a restrictive `tools` set if appropriate, or combine `allowedTools` with `disallowedTools`/`permissionMode`/`canUseTool`. Do not rely on `allowedTools` alone for policy enforcement.
- Claude is the only provider in this set with a programmatic subagent contract matching codealmanac's writer/reviewer shape. Anthropic docs define `agents: Record<string, AgentDefinition>` and `AgentDefinition` fields including `description`, `prompt`, optional `tools`, optional `disallowedTools`, optional `model`, and optional `mcpServers`. Current codealmanac passes `agents: opts.agents ?? {}` at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:116`.
- If the writer prompt expects reviewer invocation, keep that as a first-class Claude SDK feature. Do not emulate this with orchestration JSON or propose/apply state machines.

Streaming/result normalization:

- Keep `includePartialMessages: true`; Anthropic's streaming docs say this is required to receive raw stream events, and current codealmanac sets it at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:127`-`:130`.
- Normalize Claude SDK messages into a small `ProviderEvent` stream for UI/logging if needed, but retain raw `onMessage` for transcripts. Final `AgentResult` should continue to derive from SDK `result`.

## 3. Correct Codex CLI Path

For codealmanac, use `codex exec` as the supported CLI integration. Do not use the GUI's app-server path in the CLI package yet.

Why:

- Official OpenAI docs say non-interactive mode is invoked with `codex exec`, intended for scripts/CI, final output piping, and explicit sandbox/approval settings.
- `codex app-server` is available but documented as experimental in the CLI reference. The GUI uses it because it needs a persistent in-app runtime; codealmanac does not.

Command form:

```bash
codex exec --json --sandbox workspace-write --ask-for-approval never --skip-git-repo-check -C <repo-root> <combined-prompt>
```

Current codealmanac uses `codex exec --json --sandbox workspace-write --skip-git-repo-check -C <cwd>` at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:200`-`:213`. Add `--ask-for-approval never` unless live probing shows `exec` already forces non-interactive-safe behavior under `--json`. The local help for Codex `0.128.0` documents `--ask-for-approval <untrusted|on-request|never>` and recommends `never` for non-interactive runs.

Auth/status:

- Use `command -v codex` for install.
- Use `codex login status` for auth readiness. Local probe: `codex-cli 0.128.0`; `codex login status` printed `Logged in using ChatGPT`.
- OpenAI docs say CLI supports ChatGPT sign-in and API key sign-in. For API key login, `codex login --with-api-key` reads stdin; runtime may also honor `OPENAI_API_KEY`, but codealmanac should treat `codex login status` as the readiness check unless a direct API-key-only probe proves otherwise.

JSON/JSONL event format:

- Official docs and local help both say `codex exec --json` prints newline-delimited JSON events.
- Current parser expects `item.completed` with `item.type === "agent_message"` and `item.text`, plus `turn.completed` / `turn.failed` / `error` at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:367`-`:395`.
- Caveat: the Mintlify-generated Codex docs show older illustrative event names like `AgentMessage`, `FileChange`, and `TurnComplete`; local `0.128.0` docs/help and codealmanac parser use lowercase dotted event names. This must be locked by fixture tests from real `codex exec --json` output.

Model/effort options:

- Pass `--model <id>` when configured. Official reference documents `--model, -m`.
- Do not add a first-class effort flag for `codex exec` unless live help/docs expose one for `exec`. Local `codex --help` does not show `--effort`; the GUI app-server has an `effort` turn param and reasoning-effort model option, but that is app-server-specific (`/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/codex-adapter.js:142`-`:147`, `:441`-`:452`).
- If effort is needed later, probe whether `codex exec -c model_reasoning_effort="high"` or a current config key is supported. Do not invent an `--effort` flag for Codex CLI.

Sandbox/approval/cwd:

- Official OpenAI docs say `codex exec` defaults read-only; use `--sandbox workspace-write` for edits and `danger-full-access` only in controlled environments. This matches codealmanac's need to write `.almanac/pages`.
- Use `-C <repo-root>` and `cwd: <repo-root>` so CLI process and agent root agree.
- `--skip-git-repo-check` is reasonable because codealmanac wikis can be initialized in repos but the command should fail on wiki lookup, not on Codex's git heuristic.
- Do not use `--dangerously-bypass-approvals-and-sandbox`; codealmanac is a local CLI run in the user's repo and workspace-write is enough.

Tool allowlists/subagents:

- Codex CLI does not expose a Claude-compatible `allowedTools` parameter for `exec`. It has sandbox/approval/config/rules/MCP. Therefore codealmanac cannot enforce per-run `allowedTools` through Codex CLI in the same way it can with Claude SDK.
- Codex docs say subagents exist and are surfaced in CLI, but not as a per-run JSON `agents` contract equivalent to Claude SDK. codealmanac should not claim it can pass reviewer subagent definitions to Codex CLI. The current fallback that appends reviewer guidance into the prompt is honest, but metadata should mark `supportsProgrammaticSubagents: false`.

## 4. Correct Cursor CLI Path

Use `cursor-agent --print` with `stream-json` for codealmanac.

Command form:

```bash
cursor-agent --print --output-format stream-json --stream-partial-output --trust --workspace <repo-root> <combined-prompt>
```

Current codealmanac already uses this form at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:225`-`:238`.

Auth/status:

- Use `command -v cursor-agent` for install.
- Use `cursor-agent status` or `cursor-agent whoami` for auth readiness. Local `cursor-agent status --help` confirms `status|whoami` is the auth-status command. Local status probe reported "Not logged in" and then hung, so implementation needs timeout handling; current `providers.ts` already uses a 10s timeout at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/providers.ts:120`-`:127`.
- Cursor CLI also accepts `--api-key <key>` and `CURSOR_API_KEY`; codealmanac can document this, but the readiness probe should prefer `cursor-agent status` plus timeout.

Stream-json format:

- Cursor official docs define `--output-format text|json|stream-json` with `--print`, and `--stream-partial-output` only with stream-json.
- Cursor stream-json emits line-delimited JSON. The final terminal event is:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "result": "<full assistant text>",
  "session_id": "<uuid>"
}
```

- Current codealmanac parser matches this final event at `/Users/rohan/Desktop/Projects/codealmanac/src/agent/sdk.ts:397`-`:413`.
- Cursor docs also show `system`, `user`, `assistant`, and `tool_call` events. Parser should ignore unknown fields/events and read only final `result` for completion.

Model options:

- `cursor-agent --help` documents `--model <model>` with examples `gpt-5`, `sonnet-4`, `sonnet-4-thinking`, and a `models` command to list available models.
- If codealmanac stores a Cursor model override, pass `--model`. If no override, leave it unset and let Cursor choose its configured/default model.

Workspace/trust/approval:

- Use `--workspace <repo-root>`.
- Use `--trust` because codealmanac runs headless/non-interactive and cannot answer a workspace trust prompt.
- Cursor docs explicitly warn that Cursor has full write access in non-interactive mode. That is acceptable only because `bootstrap`/`capture` are AI-writing commands by design; provider metadata should surface this as a capability/risk.
- Do not add `--force`/`--yolo` by default. Local help says `--force` force-allows commands unless explicitly denied. For codealmanac, avoid silently broadening beyond headless write access.

Tool allowlists/subagents:

- Cursor CLI does not expose a per-run `allowedTools` allowlist equivalent to Claude SDK.
- Cursor CLI docs/help expose modes, MCP, rules, command approval, models, worktrees, resume, and stream output, but no programmatic subagent-definition contract equivalent to Claude `agents`.
- Therefore codealmanac cannot promise reviewer subagent execution or strict tool allowlisting for Cursor. Keep prompt-level reviewer fallback and mark capability metadata accordingly.

## 5. Proposed Smaller Provider Abstraction

Current `src/agent/sdk.ts` is doing too much: Claude SDK adapter, Codex CLI adapter, Cursor CLI adapter, JSONL runner, final parsers, and fallback prompt shaping. Split it into a small provider domain while keeping the public command-facing API stable.

Recommended file layout:

```text
src/agent/
  index.ts                 # re-export runAgent/list statuses if desired
  types.ts                 # ProviderId, RunAgentOptions, AgentResult, ProviderEvent, capabilities
  prompts.ts               # existing prompt loading remains
  auth.ts                  # Claude-specific auth can stay initially
  providers/
    index.ts               # registry + getProvider()
    claude.ts              # Anthropic SDK adapter
    codex-cli.ts           # codex exec adapter
    cursor-cli.ts          # cursor-agent adapter
    jsonl-cli.ts           # shared spawn/read JSONL helper
    status.ts              # commandExists/status probes, or keep in src/agent/providers.ts
```

Concrete TypeScript shape:

```ts
export type AgentProviderId = "claude" | "codex" | "cursor";

export interface AgentProviderCapabilities {
  transport: "sdk" | "cli-jsonl";
  writesFiles: boolean;
  supportsStrictToolAllowlist: boolean;
  supportsProgrammaticSubagents: boolean;
  supportsStreamingText: boolean;
  supportsFinalUsageCost: boolean;
  supportsProviderReportedTurns: boolean;
  supportsTokenUsage: boolean;
  supportsSessionId: boolean;
  supportsModelOverride: boolean;
  supportsReasoningEffort: boolean;
  authCheck: "claude-auth-status-or-api-key" | "codex-login-status" | "cursor-agent-status";
}

export interface AgentProviderMetadata {
  id: AgentProviderId;
  displayName: string;
  defaultModel: string | null;
  capabilities: AgentProviderCapabilities;
}

export type ProviderEvent =
  | { type: "text_delta"; content: string; raw?: unknown }
  | { type: "text"; content: string; raw?: unknown }
  | { type: "tool_use"; id?: string; tool: string; input?: string; raw?: unknown }
  | { type: "tool_result"; id?: string; isError?: boolean; raw?: unknown }
  | { type: "error"; error: string; raw?: unknown }
  | { type: "done"; result?: string; sessionId?: string; cost?: number; turns?: number; success: boolean; error?: string; raw?: unknown };

export interface RunAgentOptions {
  systemPrompt: string;
  prompt: string;
  allowedTools: string[];
  agents?: Record<string, AgentDefinition>;
  cwd: string;
  model?: string;
  maxTurns?: number;
  onMessage?: (raw: unknown) => void;
  onEvent?: (event: ProviderEvent) => void;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  checkStatus(): Promise<ProviderStatus>;
  run(opts: RunAgentOptions): Promise<AgentResult>;
}
```

Capability metadata should be explicit:

```ts
claude: {
  transport: "sdk",
  writesFiles: true,
  supportsStrictToolAllowlist: true, // only if implemented with tools/disallowedTools/canUseTool, not allowedTools alone
  supportsProgrammaticSubagents: true,
  supportsStreamingText: true,
  supportsFinalUsageCost: true,
  supportsProviderReportedTurns: true,
  supportsTokenUsage: true,
  supportsSessionId: true,
  supportsModelOverride: true,
  supportsReasoningEffort: false
}

codex: {
  transport: "cli-jsonl",
  writesFiles: true,
  supportsStrictToolAllowlist: false,
  supportsProgrammaticSubagents: false,
  supportsStreamingText: true,
  supportsFinalUsageCost: false,
  supportsProviderReportedTurns: false,
  supportsTokenUsage: true,
  supportsSessionId: unknown_until_probe,
  supportsModelOverride: true,
  supportsReasoningEffort: false
}

cursor: {
  transport: "cli-jsonl",
  writesFiles: true,
  supportsStrictToolAllowlist: false,
  supportsProgrammaticSubagents: false,
  supportsStreamingText: true,
  supportsFinalUsageCost: false,
  supportsProviderReportedTurns: false,
  supportsTokenUsage: true,
  supportsSessionId: true,
  supportsModelOverride: true,
  supportsReasoningEffort: false
}
```

Implementation guidance:

- Keep `runAgent()` as a facade to avoid churn in `bootstrap` and `capture`.
- Move provider-specific argument construction and final parsing into adapters.
- Keep `combinedPrompt()` fallback only for providers whose metadata says `supportsProgrammaticSubagents === false`.
- Rename `allowedTools` internally to something like `requestedTools` or `claudeAllowedTools` unless strict behavior is actually enforced. The current name is accurate only for Claude's auto-approval semantics and misleading for Codex/Cursor.
- Treat `onMessage` as raw provider messages for transcripts and `onEvent` as normalized messages for future display. Avoid forcing Claude, Codex, and Cursor into a lossy schema too early.

## 6. Test Plan

Unit tests:

- Adapter arg construction:
  - Claude `query()` receives `cwd`, `systemPrompt`, model default/override, maxTurns default, env marker, partial streaming, and subagents.
  - Codex CLI receives `exec --json --sandbox workspace-write --ask-for-approval never --skip-git-repo-check -C <cwd>`.
  - Cursor CLI receives `--print --output-format stream-json --stream-partial-output --trust --workspace <cwd>`.
- Auth/status:
  - Missing binary -> installed false.
  - Status command success -> authenticated true.
  - Status command non-zero/hang -> authenticated false with useful detail.
  - Claude OAuth false + `ANTHROPIC_API_KEY` set -> authenticated true.
- Parsers:
  - Claude success/error result messages.
  - Codex real JSONL fixture: agent-message result, turn completed, turn failed/error.
  - Cursor stream-json fixture: assistant/tool events ignored, final `result` parsed, error result parsed.
- Capability metadata:
  - Claude is the only provider with programmatic subagents.
  - Codex/Cursor reject or warn if caller expects strict `allowedTools`.

Integration tests with fake CLIs:

- Put temp fake `codex`/`cursor-agent` scripts first on `PATH`; assert spawn args and feed deterministic JSONL.
- Use existing `withTempHome` for anything touching `~/.almanac`.
- Verify `capture`/`bootstrap` still only AI-writing commands; query commands must never instantiate providers.

Manual smoke tests on a machine with live CLIs:

```bash
codex exec --json --sandbox workspace-write --ask-for-approval never --skip-git-repo-check -C /tmp/almanac-probe "Write a one-line note to .almanac/pages/probe.md"
cursor-agent --print --output-format stream-json --stream-partial-output --trust --workspace /tmp/almanac-probe "Write a one-line note to .almanac/pages/probe.md"
```

Capture stdout/stderr as fixtures after redacting ids/emails.

## Unknowns Requiring Live CLI Probing

- Exact current `codex exec --json` event names and final result shape for Codex CLI `0.128.0+`. Current code expects dotted lowercase events, but official generated docs still show older illustrative names in places.
- Whether `codex exec` emits a stable session/thread id in JSONL and where.
- Whether `codex exec` supports a documented config override for reasoning effort in non-interactive mode; no `--effort` flag appeared in local help.
- Whether `codex exec --ask-for-approval never --sandbox workspace-write` is fully non-interactive for all write/shell operations, or whether some operations still fail/need config/rules.
- Whether `OPENAI_API_KEY` alone makes `codex login status` return success or whether codealmanac should separately treat the env var as auth-ready.
- Cursor logged-in `cursor-agent status` output shape and exit code; local probe was not logged in and hung after printing "Not logged in".
- Cursor live `stream-json` behavior with `--stream-partial-output`: exact text-delta event names, duplicate assistant events, and error result shape.
- Cursor model listing format from `cursor-agent models` on a logged-in account.
- Whether Cursor has any current hidden/ACP mechanism that could enforce a tool allowlist. Do not assume this exists until official docs or live help prove it.

## Recommendation

Implement providers as small adapters behind a stable `runAgent()` facade. Claude remains the full-fidelity provider because the SDK supports auth, streaming, model selection, result/cost/turn normalization, and programmatic reviewer subagents. Codex and Cursor should be treated as CLI JSONL providers with model override and streaming, but without strict tool allowlists, provider-reported USD cost/turn accounting, or programmatic subagent definitions. If their JSONL streams include token usage, preserve it as usage metadata rather than pretending it is the same contract as Claude's result message. Their reviewer behavior should stay prompt-level fallback unless a future official CLI surface exposes a real subagent contract.
