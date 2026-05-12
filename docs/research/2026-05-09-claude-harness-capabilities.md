# Claude Harness Capabilities For CodeAlmanac

Date: 2026-05-09

Scope: Claude Code and the Anthropic Claude Agent SDK as the harness for
CodeAlmanac Build, Absorb, and Garden operations. This note intentionally
excludes Codex/Cursor implementation details except where comparison affects the
Claude adapter boundary.

Primary sources:

- Anthropic Claude Agent SDK TypeScript reference:
  https://platform.claude.com/docs/en/agent-sdk/typescript
- Claude Code Agent SDK overview:
  https://code.claude.com/docs/en/agent-sdk/overview
- Claude Code Agent SDK streaming:
  https://code.claude.com/docs/en/agent-sdk/streaming-output
- Claude Code Agent SDK subagents:
  https://code.claude.com/docs/en/agent-sdk/subagents
- Claude Code subagents:
  https://code.claude.com/docs/en/sub-agents
- Claude Code memory / `CLAUDE.md`:
  https://code.claude.com/docs/en/memory
- Claude Code settings, permissions, and sandboxing:
  https://code.claude.com/docs/en/settings
- Claude Code hooks:
  https://code.claude.com/docs/en/hooks
- Claude Code MCP with the Agent SDK:
  https://code.claude.com/docs/en/agent-sdk/mcp
- Claude model overview:
  https://platform.claude.com/docs/en/about-claude/models/overview
- Claude Agent SDK cost tracking:
  https://code.claude.com/docs/en/agent-sdk/cost-tracking
- Local code inspected:
  `src/agent/providers/claude/index.ts`, `src/agent/providers/claude/auth.ts`,
  `src/agent/types.ts`, `src/commands/bootstrap.ts`,
  `src/commands/capture.ts`, `src/agent/providers/prompt.ts`,
  `docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md`,
  `prompts/bootstrap.md`, `prompts/writer.md`, `prompts/reviewer.md`.

## Executive Conclusions

Use Claude as CodeAlmanac's highest-fidelity harness, not as the product
architecture. CodeAlmanac should own provider-agnostic operations, prompt
assembly, source descriptors, logs, state, summaries, page-delta accounting, and
indexing. Claude should provide the file-reading/editing runtime, Bash/Grep/Glob
tools, programmatic subagents, streaming, cost/usage, permissions, hooks, MCP,
and optional skills/plugins.

Keep Build, Absorb, and Garden as prompt-defined operations. Do not introduce a
TypeScript propose/review/apply state machine. The local design doc already says
"Prompts define the algorithm" and "The provider CLI/SDK is the harness"; the
Claude SDK maps cleanly to that model.

Important correction: `allowedTools` is not a strict availability boundary for
the main agent. In current SDK docs and type comments, `allowedTools` means
auto-allow / pre-approve tool use. To restrict which built-in tools are actually
available, pass `tools`. For subagents, `AgentDefinition.tools` is the right
allowlist.

## Claude Agent SDK Query Shape

The TypeScript SDK call is:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const q = query({
  prompt,
  options: {
    systemPrompt,
    cwd,
    model,
    maxTurns,
    maxBudgetUsd,
    tools,
    allowedTools,
    disallowedTools,
    canUseTool,
    permissionMode,
    sandbox,
    agents,
    mcpServers,
    hooks,
    skills,
    settingSources,
    includePartialMessages,
    pathToClaudeCodeExecutable,
    env,
  },
});
```

Relevant option meanings for CodeAlmanac:

- `prompt`: the concrete user task for this run, such as "Absorb this session"
  plus absolute source paths, repo root, source size, and any cheap inventory.
- `systemPrompt`: operation doctrine and instructions. It can be a string,
  string array with a dynamic prompt-cache boundary, or Claude Code preset with
  appended instructions. CodeAlmanac currently uses custom strings loaded from
  `prompts/*.md`.
- `cwd`: repo root. Tool paths and Bash execution should be rooted here.
- `model`: full model ID such as `claude-sonnet-4-6`; subagents can use aliases
  such as `sonnet`, `opus`, or full IDs.
- `maxTurns`: hard cap on agentic turns. It stops the run rather than giving a
  graceful wrap-up turn, so set generously for Absorb/Garden.
- `maxBudgetUsd`: hard cost cap. Use for expensive batch/garden operations.
- `tools`: actual set of built-in tools available to the main agent, for example
  `["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"]`.
- `allowedTools`: tools or permission patterns pre-approved for execution. This
  is auto-approval-ish; it does not replace `tools` for availability restriction.
- `disallowedTools`: explicit removal / denial layer.
- `canUseTool`: custom permission handler called before tool execution. This is
  the clean SDK-level place to block destructive Bash or enforce write scope.
- `permissionMode`: `default`, `acceptEdits`, `bypassPermissions`, `plan`,
  `dontAsk`, or `auto`. Headless CodeAlmanac runs should avoid interactive
  prompts; pair `dontAsk` or explicit allow rules with `tools`/`canUseTool`.
- `sandbox`: optional command sandboxing. It controls sandbox behavior; actual
  filesystem/network restrictions come from permission rules.
- `agents`: programmatic subagent definitions available through the `Agent` tool.
- `mcpServers`: local/stdout/SSE/HTTP/SDK MCP servers for tools/resources.
- `hooks`: programmatic hooks, useful for policy and observability around tool
  use.
- `skills`: enabled Claude Code skills for the session. This filters skill
  availability; skill files are still plain files and should not contain secrets.
- `settingSources`: which filesystem settings to load. Current docs say omitted
  loads CLI defaults; pass `[]` for SDK isolation mode, or include `"project"` to
  load project `CLAUDE.md`.
- `includePartialMessages`: required for partial streaming message events.
- `pathToClaudeCodeExecutable`: points the SDK at the installed `claude` binary.
- `env`: pass `CODEALMANAC_INTERNAL_SESSION=1` and any provider environment.

Current CodeAlmanac maps only part of this surface in
`src/agent/providers/claude/index.ts`: `prompt`, `systemPrompt`,
`allowedTools`, `agents`, `cwd`, `model`, `maxTurns`,
`pathToClaudeCodeExecutable`, `env`, and `includePartialMessages`. The next
Claude adapter pass should add `tools`, usage capture, explicit
`settingSources`, and permission policy.

## Reusable Guidance: Prompt Modules First

CodeAlmanac's reusable guidance should remain bundled prompt modules, not
Claude-only filesystem features. Recommended prompt layering:

```text
base/wiki-doctrine.md
+ operations/build.md | operations/absorb.md | operations/garden.md
+ sources/session.md | sources/file-folder.md | sources/git-diff.md | ...
+ optional provider/source flavor, e.g. sources/session-claude.md
+ concrete source descriptor in the user prompt
```

Why prompt modules first:

- They are provider-agnostic and work with Claude, Codex, Cursor, and future
  harnesses.
- They match the project philosophy: intelligence in prompts, not pipeline code.
- They are versioned and shipped with the npm package.
- They avoid depending on a user's personal Claude Code setup.

Claude-native reusable guidance should be additive:

- `CLAUDE.md`: good for interactive Claude Code users and project conventions,
  but not the core harness algorithm. It is persistent ambient context, not a
  precise operation module. Claude docs recommend concise memory files; they are
  loaded depending on settings and scope.
- Skills: good for reusable Claude-specific workflows or rich support files. Do
  not require them for Build/Absorb/Garden. They can be offered later via a
  Claude plugin or local skill install for users who want interactive
  CodeAlmanac commands inside Claude Code.
- Slash commands: useful for humans invoking Claude workflows, but recent Claude
  docs position richer reusable workflows as skills. Not a core SDK integration
  primitive for CodeAlmanac.
- Hooks: use for deterministic policy or observability, not instruction text.
- MCP: use later when CodeAlmanac exposes structured wiki/search/index resources
  to any agent. Do not use MCP resources just to pass source-specific prose that
  can live in the assembled prompt.

## Programmatic Subagents

Claude's `AgentDefinition` supports:

```ts
type AgentDefinition = {
  description: string;
  prompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: string;
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];
  initialPrompt?: string;
  maxTurns?: number;
  background?: boolean;
  memory?: "user" | "project" | "local";
  effort?: "low" | "medium" | "high" | "xhigh" | "max" | number;
  permissionMode?: PermissionMode;
};
```

The parent invokes a subagent with the `Agent` tool. The subagent gets a fresh
context plus its own prompt/tools/model, works in the same `cwd`, and returns
text as the tool result. Stream consumers should tolerate older `Task` naming
when detecting subagent tool calls because Claude docs note that compatibility
path.

Recommended CodeAlmanac subagents:

- `reviewer`: read-only critique of a proposed local wiki change. Tools:
  `Read`, `Grep`, `Glob`, maybe `Bash` for read-only `almanac`/`git` commands.
  No `Write`, no `Edit`, no `Agent`. This matches the current capture shape in
  `src/commands/capture.ts`.
- `researcher`: investigates a source/repo area and returns findings with file
  and wiki references. Tools: `Read`, `Grep`, `Glob`, read-only `Bash`. Add web
  tools only when a source type explicitly allows external research.
- `scout`: cheap broad exploration for Build/Garden. Tools: `Read`, `Grep`,
  `Glob`, read-only `Bash`. Use a cheaper model/effort when configured.
- `reviewer-strict` or `consistency-reviewer`: optional Opus/high-effort agent
  for Garden or high-impact Absorb runs.

Do not wrap subagents in CodeAlmanac JSON proposal schemas. Let the writer or
gardener call subagents when the prompt says a second set of eyes is useful,
then decide how to incorporate the textual critique.

## Source Guidance Recommendation

Pass source-specific guidance as assembled prompt text. Do not use
`CLAUDE.md`, skill files, agent definitions, or MCP resources as the primary
carrier for session/file/git-diff guidance.

Rationale:

- Source guidance is operation-specific and should be identical across provider
  harnesses.
- It changes per invocation, especially for session IDs, transcript paths, diff
  ranges, file targets, and size summaries.
- It should be easy to test as prompt assembly without requiring Claude Code
  settings on disk.
- It should not become ambient context that pollutes unrelated interactive
  Claude sessions.

Recommended split:

- System prompt: durable doctrine, operation rules, source-type method, allowed
  wiki moves, quality bar, no-op standard, reviewer policy.
- User prompt: concrete source descriptor, absolute paths, rev/range, repo root,
  inventory summary, and any deterministic evidence CodeAlmanac collected.
- Subagent definitions: role prompts and tool restrictions, not source payloads.
- MCP resources: future structured access to wiki/index/search when useful, not
  the default guidance channel.

## Auth, Models, Sandboxing, Streaming, And Cost

Auth:

- Official SDK docs describe `ANTHROPIC_API_KEY` and third-party provider
  credentials as the standard SDK auth path.
- Current CodeAlmanac also accepts Claude subscription OAuth by probing
  `claude auth status --json`, then falls back to `ANTHROPIC_API_KEY`.
- This is useful for local personal CLI usage, but it is a product/compliance
  risk if CodeAlmanac presents itself as a third-party app relying on claude.ai
  subscription auth. Keep the API-key path documented and be explicit about
  subscription-auth assumptions.

Models:

- Current default `claude-sonnet-4-6` is a sensible default for Build/Absorb.
- Let users configure full model IDs. Use `claude-opus-*` for expensive Garden
  or strict review when configured.
- Subagents can inherit the parent model or specify aliases/full IDs. Prefer
  role-based defaults: scout cheap, writer Sonnet, strict reviewer/Garden Opus
  when cost is acceptable.
- SDK model and effort support changes quickly. Keep model IDs in config, not
  hard-coded scattered strings.

Sandboxing and permissions:

- Use `tools` to expose only the required built-ins.
- Use `allowedTools` for auto-approval, not as the security boundary.
- Use `canUseTool` or `PreToolUse` hooks to block destructive Bash patterns:
  `git commit`, `git push`, `git reset`, `git checkout`, `git clean`, `git rm`,
  `git rebase`, `git merge`, broad `rm`, and network installs unless explicitly
  allowed.
- For write-capable operations, allow file writes under `.almanac/` and avoid
  source-code edits. If exact path-level enforcement cannot be perfect through
  Claude tools alone, enforce with permission hooks and post-run diff checks.
- Use `sandbox` for Bash isolation where available, but do not treat it as the
  only policy layer. Claude docs distinguish sandbox settings from permission
  rules.

Streaming:

- Keep `includePartialMessages: true`.
- Log raw SDK JSONL for postmortems.
- Normalize provider events for user-facing progress. Watch for tool uses,
  subagent starts/progress, tool results, final `result`, permission denials,
  rate limit events, and hook events if enabled.
- Current `StreamingFormatter` tracks `Agent` tool-use and per-tool output; it
  should be tolerant of `Task` naming and newer subagent progress messages.

Cost and usage:

- Final SDK result includes `total_cost_usd`, `num_turns`, `session_id`, `usage`,
  and `modelUsage` in current SDK types.
- Costs are reported estimates, not billing truth.
- Current CodeAlmanac captures cost and turns but marks Claude
  `supportsUsage: false`. Update the adapter to populate `AgentUsage` from
  `usage` and maybe preserve provider-native `modelUsage`.
- Track: provider, model, effort/thinking when set, cost, usage, model usage,
  duration, turn count, session id, source type/size, pages delta, raw log path,
  and visible subagent count.

## Limitations Compared With Codex Support

Claude advantages for CodeAlmanac:

- Programmatic subagents with role prompts, tool restrictions, models, effort,
  and max turns.
- Rich SDK stream with tool messages, subagent signals, final cost, usage, and
  session ID.
- Hooks and `canUseTool` for policy.
- MCP support for future structured wiki/index tools.
- Skills/plugins for optional Claude-native reusable workflows.

Claude limitations / risks:

- SDK and Claude Code version churn is high. At research time, npm latest for
  `@anthropic-ai/claude-agent-sdk` was newer than the package installed in this
  checkout. Verify lockfile/install before relying on newer fields such as
  `skills`, `forwardSubagentText`, session stores, or newer model/effort values.
- Auth has two worlds: official API-key SDK auth and Claude Code subscription
  auth. The latter is convenient locally but should not be assumed for all users
  or distribution contexts.
- Claude-specific subagents, skills, hooks, and settings do not port cleanly to
  Codex/Cursor. Keep them behind capability metadata.
- `allowedTools` naming is easy to misuse. The adapter API should separate
  "available tools" from "pre-approved tools" so provider integrations do not
  encode the wrong security model.
- Loading user/project Claude settings can make CodeAlmanac runs less
  reproducible. Decide explicitly whether a run is isolated or inherits Claude
  project context.

Codex comparison relevant to adapter design:

- Codex CLI support should remain a lower-fidelity harness with prompt fallback
  for reviewer behavior. Current `src/agent/providers/prompt.ts` already folds
  reviewer guidance into non-Claude prompts when programmatic subagents are not
  supported.
- Do not let Claude features leak into provider-agnostic operation semantics.
  Provider capabilities should decide whether subagents are real, emulated, or
  unavailable.

## Recommended Adapter Shape

Provider-agnostic types should describe CodeAlmanac intent, not Claude option
names:

```ts
type OperationKind = "build" | "absorb" | "garden";

type SourceKind =
  | "session"
  | "file"
  | "folder"
  | "git-diff"
  | "pr"
  | "issue"
  | "document";

type ToolIntent =
  | "readRepo"
  | "writeWiki"
  | "searchRepo"
  | "readOnlyShell"
  | "subagents"
  | "web"
  | "mcp";

type SubagentRole = "reviewer" | "researcher" | "scout";

interface PromptBundle {
  systemBlocks: string[];
  userPrompt: string;
}

interface HarnessRunOptions {
  operation: OperationKind;
  source: SourceDescriptor;
  prompt: PromptBundle;
  cwd: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTurns?: number;
  maxBudgetUsd?: number;
  toolIntents: ToolIntent[];
  subagents?: Record<SubagentRole, SubagentSpec>;
  settingsMode?: "isolated" | "project" | "user-project-local";
  onEvent?: (event: ProviderEvent) => void;
}

interface HarnessRunResult {
  success: boolean;
  result: string;
  sessionId?: string;
  costUsd?: number;
  turns?: number;
  usage?: AgentUsage;
  providerNativeUsage?: unknown;
  error?: string;
}
```

Claude adapter mapping:

- `PromptBundle.systemBlocks` -> `systemPrompt`. Consider string arrays and the
  SDK dynamic-boundary marker later for prompt caching.
- `PromptBundle.userPrompt` -> `prompt`.
- `toolIntents` -> `tools`, `allowedTools`, `canUseTool`, and optional hooks.
- `subagents` -> `agents: Record<string, AgentDefinition>`.
- `settingsMode: "isolated"` -> `settingSources: []`, `skills: []` unless
  explicitly enabled.
- `settingsMode: "project"` -> `settingSources: ["project"]` to load project
  `CLAUDE.md` where intended.
- `maxBudgetUsd`, `maxTurns`, `model`, `effort` -> direct SDK options.
- Raw SDK messages -> provider-neutral event stream plus JSONL logs.
- Final SDK result -> `HarnessRunResult` with cost, turns, usage, model usage,
  session ID, and error subtype.

Concrete next changes for the Claude adapter:

1. Rename the public concept from `allowedTools` to something like
   `availableTools` plus `autoApproveTools`.
2. Pass SDK `tools` for main-agent availability restriction.
3. Keep `allowedTools` only for auto-approval / non-interactive permission
   behavior.
4. Add `canUseTool` or hooks to enforce destructive-command and write-scope
   policy.
5. Capture `usage` and `modelUsage` from final `result`.
6. Set `settingSources` explicitly so runs are reproducible by default.
7. Treat Claude skills/plugins as optional integration affordances, not the
   source-guidance mechanism.
