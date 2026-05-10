# Harness And Process Architecture

We are fundamentally refactoring and remaking our repository. Do not shy away from big changes and giving up what we have completely. Also cursor is future work do not implement it,

## Purpose

This document defines the next `codealmanac` architecture for running AI wiki
operations through Claude, Codex, later Cursor, and future providers.

It refines `docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md`.
That document defines the product operations:

```text
Build
Absorb
Garden
```

This document defines the execution architecture underneath those operations.

The core idea is:

```text
CodeAlmanac owns the wiki operation.
The harness SDK owns provider-neutral agent execution.
Provider adapters translate that execution request to Claude, Codex, Cursor, etc.
The process manager owns jobs, logs, status, and lifecycle.
```

## Design Principles

### Build a small internal harness SDK

Claude Agent SDK, Codex CLI / SDK, and Cursor CLI are all generalized agent
harnesses. CodeAlmanac should wrap them with its own small provider-neutral
harness API.

The product operations should not call Claude- or Codex-specific APIs directly.
They should construct one run specification and hand it to CodeAlmanac's harness
layer.

Bad shape:

```text
Garden -> startClaudeWithReviewer()
Absorb -> startCodexWithPromptFallback()
Build  -> runClaudeBootstrap()
```

Good shape:

```text
Build / Absorb / Garden -> AgentRunSpec -> Process Manager -> Harness SDK -> Provider Adapter
```

### Copy OpenAlmanac GUI's provider boundary, not its chat UI

OpenAlmanac GUI has the right provider boundary:

```text
provider service facade
  -> provider-specific adapters
    -> normalized runtime events
      -> app/runtime layer
```

CodeAlmanac should use the same pattern, scaled down for CLI jobs:

```text
operation
  -> process manager
    -> harness SDK
      -> provider adapter
        -> normalized events
```

Provider adapters own provider quirks. Everything above them sees one execution
model.

Use the GUI implementation as the reference for provider architecture:

- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/service.js`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/claude-adapter.js`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/codex-adapter.js`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/shared/providers/runtime-events.d.ts`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/src/domains/providers/models.ts`

Do not copy the renderer/UI side of the GUI. CodeAlmanac does not need the chat
app runtime, IPC surface, message store, model-picker UI, or renderer state.
Copy the provider facade, adapter contract, capability metadata, model selection
shape, auth/status routing, and normalized runtime-event contract.

### Do not over-abstract prompt assembly

Build, Absorb, and Garden can select and concatenate prompt files directly.
They may append source-specific or target-specific text when useful, or attach
provider skills/MCP configuration when the selected provider supports it.

There should not be a separate "source layer" or "evidence pipeline" that tries
to model this as its own product concept.

The operation should build a prompt and run it.

## Layering

### CLI Layer

The CLI is the frontend. It expresses user intent and resolves flags/config.

Public write-capable commands:

```bash
almanac init
almanac capture
almanac ingest <file-or-folder>
almanac garden
```

Process inspection commands:

```bash
almanac jobs
almanac jobs show <run-id>
almanac jobs attach <run-id>
almanac jobs logs <run-id>
almanac jobs cancel <run-id>
```

The exact command names can still be finalized. The important rule is that all
write-capable AI operations become CodeAlmanac jobs by default.

Public commands map to internal operations:

```text
init    -> Build
capture -> Absorb, with coding-session prompt context
ingest  -> Absorb, with user-provided file/folder prompt context
garden  -> Garden
```

There is no public `almanac absorb` command in this design. Absorb is the
internal operation shared by `capture` and `ingest`.

Recommended command surface:

```bash
# Build the first useful wiki for this repo.
almanac init
almanac init --using <provider[/model]>
almanac init --force
almanac init --background
almanac init --json

# Absorb the latest detectable coding session for this repo.
almanac capture

# Absorb the latest session from one app.
almanac capture --app <claude|codex|cursor>

# Absorb a specific coding session.
almanac capture --app <claude|codex|cursor> --session <id>
almanac capture <session-file>
almanac capture <session-file...>

# Absorb a bounded set of recent sessions.
almanac capture --app <claude|codex|cursor> --since <duration-or-date>
almanac capture --all-apps --since <duration-or-date>
almanac capture --app <claude|codex|cursor> --limit <n>
almanac capture --app <claude|codex|cursor> --all --yes

# Use a specific provider/model to write the wiki, independent of session app.
almanac capture --app codex --using claude/sonnet

# Absorb user-provided context.
almanac ingest <file-or-folder>
almanac ingest <file-or-folder> --using <provider[/model]>
almanac ingest <file-or-folder> --yes
almanac ingest <file-or-folder> --foreground
almanac ingest <file-or-folder> --json

# Improve the wiki as a whole graph.
almanac garden
almanac garden --using <provider[/model]>
almanac garden --foreground
almanac garden --json
```

Flag meanings:

```text
--using <provider[/model]>
  Select the wiki-writing provider/model for this run.
  Examples: claude/sonnet, claude/opus, codex/gpt-5.3-codex, codex.

--app <claude|codex|cursor>
  Select which coding app's session history to capture.
  This is independent of --using.

--session <id>
  Capture one specific session id from the selected app.

--since <duration-or-date>
  Capture sessions after a duration/date, such as 7d or 2026-05-01.

--limit <n>
  Limit the number of matching sessions.

--all
  Capture all matching sessions. Expensive; require confirmation or --yes.

--all-apps
  Search all supported coding apps for sessions.

--yes
  Confirm expensive/background-safe operations without prompting.

--background
  Start the CodeAlmanac job and return the run id immediately.

--foreground
  Keep the terminal attached and stream progress until the job finishes.

--json
  Emit machine-readable command output. Cannot be combined with --foreground.

--force
  For init only: allow rebuilding/replacing an existing populated wiki.
```

Default run modes:

```text
init:
  foreground by default because first-time setup is an onboarding action.
  Use --background to start it as a detached job.

capture:
  background by default because it is usually hook/session-end work.
  Use --foreground to watch it.

ingest:
  background by default because it may be expensive and long-running.
  Use --foreground to watch it.

garden:
  background by default because it may make broad wiki changes.
  Use --foreground to watch it.
```

There is no `--quiet` flag in the core design. The output mode is determined by
the run mode:

```text
foreground  -> stream human-readable progress
background  -> print the started run id and exit
json        -> print structured command output for scripts
```

### Operation Layer

The operation layer owns product semantics:

```text
Build  -> create the first useful wiki
Absorb -> improve the wiki from a user/session/diff starting point
Garden -> improve the wiki as a whole graph
```

This layer chooses:

- operation prompt
- any additional prompt text
- provider/model from flags/config
- tools requested
- optional helper agent specs
- skills/MCP attachments when appropriate
- run metadata for logs/status

It does not own provider mechanics.

### Process Manager

The process manager owns CodeAlmanac job lifecycle.

All AI write operations should run through it. Background should be the default.
Users can opt into attached foreground behavior with `--foreground`.

Responsibilities:

- create CodeAlmanac run ids
- write run state records
- start foreground or detached background jobs
- track PID
- detect stale jobs
- write raw event logs under `.almanac/runs/`
- expose job status
- attach/tail running jobs
- cancel/interrupt jobs when possible
- snapshot wiki pages before and after the run
- compute created/updated/archived counts
- record provider/model/duration/cost/usage when available
- reindex after successful wiki writes
- mark final status as done, failed, cancelled, or stale

Run records are per wiki and must be gitignored:

```text
repo/.almanac/runs/
  run_abc123.json
  run_abc123.jsonl
```

The generated ignore rules should include:

```gitignore
.almanac/index.db
.almanac/runs/
```

Per-wiki storage means:

```bash
cd repo-a
almanac jobs
```

shows jobs for `repo-a`, while:

```bash
cd repo-b
almanac jobs
```

shows jobs for `repo-b`.

A future global index can support `almanac jobs --all`, but each wiki's
`.almanac/runs/` directory should remain the source of truth.

### Harness SDK

The harness SDK is CodeAlmanac's internal provider-neutral agent API.

It should look like a small wrapper around the common shape of Claude Agent SDK,
Codex CLI / SDK, and Cursor CLI:

```ts
interface AgentRunSpec {
  provider: {
    id: "claude" | "codex" | "cursor";
    model?: string;
    effort?: string;
  };

  cwd: string;

  systemPrompt?: string;
  prompt: string;

  tools?: ToolRequest[];
  agents?: Record<string, AgentSpec>;
  skills?: string[];
  mcpServers?: Record<string, McpServerSpec>;

  limits?: {
    maxTurns?: number;
    maxCostUsd?: number;
  };

  output?: {
    schemaPath?: string;
  };

  metadata?: {
    operation: "build" | "absorb" | "garden";
    targetKind?: string;
    targetPaths?: string[];
  };
}
```

The exact TypeScript names can change. The important point is that there is one
payload for provider execution.

Build, Absorb, and Garden construct this payload. The harness SDK runs it.

### Provider Adapters

Provider adapters translate `AgentRunSpec` into provider-specific calls.

Claude adapter maps:

```text
systemPrompt -> Claude systemPrompt
prompt       -> Claude prompt
agents       -> Claude AgentDefinition map
skills       -> Claude skills
mcpServers   -> Claude mcpServers
tools        -> Claude tools / permissions
model        -> Claude model
```

Codex adapter maps:

```text
systemPrompt + prompt -> Codex transport selected by adapter
model                 -> --model / model param
cwd                   -> -C / thread cwd
skills                -> Codex skills when supported/configured
mcpServers            -> Codex MCP configuration when supported/configured
agents                -> Codex custom agents if supported; otherwise prompt fallback
tools                 -> sandbox, approval, config, prompt policy
```

The Codex transport is an adapter-internal decision. The adapter may use
`codex exec --json`, Codex app-server, or a Codex SDK. Prefer the transport that
gives the best lifecycle and capability mapping without leaking Codex-specific
runtime details above the adapter. In particular, Codex app-server or SDK-style
integration may be preferable if CodeAlmanac needs thread resume, interrupt,
context usage, reasoning effort, or richer event streaming.

The same rule applies to Claude: the adapter can use Claude Agent SDK features
such as `query()`, `agents`, skills, MCP, hooks, and permissions, but those
details should remain behind the provider adapter.

The operation layer should not care whether a provider receives data through an
SDK object, CLI args, stdin, config files, or app-server messages.

### Wiki Layer

The wiki layer remains local and deterministic:

- `.almanac/pages/*.md`
- `.almanac/topics.yaml`
- `.almanac/index.db`
- registry
- reindex
- health/query commands

The harness can write markdown pages. CodeAlmanac snapshots, indexes, and
reports the result.

## Tools

Do not introduce high-level toolsets such as `wikiWriter` or `scoutTools`.

Use a small registry of base tool requests. The operation asks for basic
capabilities; the adapter maps them to provider-native tools.

Examples:

```ts
type ToolRequest =
  | { id: "read" }
  | { id: "write" }
  | { id: "edit" }
  | { id: "search" }
  | { id: "shell"; policy?: "read-only" | "default" }
  | { id: "web" }
  | { id: "mcp"; server?: string };
```

Provider mappings:

```text
CodeAlmanac read   -> Claude Read / Codex native file reading
CodeAlmanac write  -> Claude Write / Codex native editing
CodeAlmanac edit   -> Claude Edit / Codex native editing
CodeAlmanac search -> Claude Glob+Grep / Codex native search
CodeAlmanac shell  -> Claude Bash / Codex shell
CodeAlmanac mcp    -> provider MCP configuration
```

The registry is not a security boundary by itself. It describes desired
capabilities. Each provider adapter must map those requests to the strongest
available enforcement:

- Claude can expose exact built-in tools and use permission hooks.
- Codex CLI may rely more on sandbox, approval policy, config, and prompt
policy unless a stronger SDK/custom-agent mechanism is used.

Before implementation, research the current Claude, Codex, and Cursor tool
surfaces and lock the adapter behavior with tests.

## Agents And Helper Agents

Do not treat `reviewer`, `scout`, `researcher`, or `gardener` as provider
features. ALSO THEY ARE OUTDATED PLEASE USE NEW ARCHITECTURE FOR EACH. For now each prompt for garden/absorb/build can be decently small. DO NOT MAKE NEW SUBAGENTS AND PLEASE REMOVE REVIEWER ETC.

They are optional CodeAlmanac agent specs inside `AgentRunSpec`.

Example:

```ts
agents: {
  reviewer: {
    description: "Review proposed wiki edits for graph quality.",
    prompt: reviewerPrompt,
    tools: [{ id: "read" }, { id: "search" }, { id: "shell", policy: "read-only" }],
  },
}
```

Provider mapping:

```text
Claude SDK:
  agents -> real AgentDefinition entries

Codex CLI today:
  agents -> prompt fallback / custom-agent integration only when implemented

Future Codex SDK:
  agents -> SDK-native programmable agents if exposed
```

The operation asks for helper agents when useful. The provider adapter decides
whether they become real subagents, provider-configured agents, or plain prompt
instructions.

## Prompt Assembly

Keep this simple.

Prompts live at the package root under `prompts/`, not inside `src/`. They are
shipped with the npm package as markdown files.

Prompt-writing philosophy is already defined elsewhere:

- Source-of-truth spec:
  `/Users/rohan/Desktop/Projects/openalmanac/docs/ideas/codebase-wiki.md`
  under "Design Philosophy" explains "intelligence in the prompt, not in the
  pipeline" and says prompts should be opinionated about standards while open
  about process.
- Operation design:
  `docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md` under
  "Prompt-Based Algorithm Design" explains that prompts should describe the
  objective, quality bar, allowed moves, recommended strategies, and success
  criteria, while deterministic code handles setup, logs, snapshots, indexing,
  and summaries.

Start with this minimal layout:

```text
prompts/
  operations/
    build.md
    absorb.md
    garden.md
  agents/
    .gitkeep
```

`prompts/agents/` is intentionally empty at first. It reserves the convention
for future helper-agent prompts without keeping the old hardcoded reviewer/scout
architecture.

The prompt loader should support slash paths:

```ts
loadPrompt("operations/build")
loadPrompt("operations/absorb")
loadPrompt("operations/garden")
```

Prompt composition should be plain string joining:

```ts
joinPrompts([
  await loadPrompt("operations/absorb"),
  "This run is absorbing a coding session transcript.",
  `Transcript: ${transcriptPath}`,
  `Working directory: ${repoRoot}`,
]);
```

No manifest, prompt graph, or source/evidence abstraction is needed at this
stage. Operations can load markdown prompt files and append runtime strings:

```text
operation prompt
+ optional runtime context string
+ concrete file/session/wiki paths
```

Future prompt folders such as `prompts/base/` or provider/context-specific
files can be added when real duplication appears. The initial architecture only
requires operation prompts.

This does not need a separate "source" or "evidence" abstraction.

The target kind is metadata and prompt input, not a standalone architecture
layer.

Avoid this shape:

```text
source -> adapter -> evidence bundle -> wiki writer
```

Prefer this shape:

```text
operation -> prompt + harness run spec -> provider
```

If skills are useful, attach skills. If MCP is useful, attach MCP servers. If a
plain prompt is enough, use a plain prompt.

Initial prompt responsibilities:

```text
operations/build.md
  Build the first useful wiki for a repo. Survey the repo, identify durable
  anchors, create coherent initial pages/topics, and avoid placeholder spam.

operations/absorb.md
  Improve an existing wiki from a starting context such as a coding session,
  file, folder, or diff. The input is not the output. No-op is valid.

operations/garden.md
  Improve the existing wiki as a whole graph. Merge/split/archive/relink/retopic
  where useful, create hubs when they clarify navigation, and avoid unrelated
  churn.
```

## Process UX

All write-capable AI operations should default to background jobs.

Example:

```bash
almanac garden
```

prints:

```text
started garden run run_abc123
status: almanac jobs show run_abc123
attach: almanac jobs attach run_abc123
```

Foreground mode:

```bash
almanac garden --foreground
```

Job listing:

```bash
almanac jobs
```

Example output:

```text
ID          Status    Operation  Provider        Started
run_abc123  running   garden     claude/sonnet   2m ago
run_def456  done      absorb     codex/gpt-5     1h ago
run_ghi789  failed    build      claude/sonnet   yesterday
```

Job detail:

```bash
almanac jobs show run_abc123
```

Attach/tune in:

```bash
almanac jobs attach run_abc123
```

Initial implementation can tail the JSONL or human-readable log. It does not
need provider-native session resume on day one.

Cancel:

```bash
almanac jobs cancel run_abc123
```

If the provider supports graceful interrupt, use it. Otherwise terminate the
child process and mark the job cancelled or stale.

## Run Records

Every CodeAlmanac AI operation gets a CodeAlmanac run id, independent of the
provider's session/thread id.

Example:

```json
{
  "id": "run_abc123",
  "operation": "garden",
  "status": "running",
  "provider": "claude",
  "model": "claude-sonnet-4-6",
  "providerSessionId": null,
  "pid": 12345,
  "startedAt": "2026-05-10T18:30:00.000Z",
  "logPath": ".almanac/runs/run_abc123.jsonl",
  "metadata": {
    "targetKind": "wiki"
  }
}
```

Final records add:

```json
{
  "status": "done",
  "finishedAt": "2026-05-10T18:37:00.000Z",
  "durationMs": 420000,
  "summary": {
    "created": 1,
    "updated": 4,
    "archived": 0,
    "costUsd": 0.19,
    "inputTokens": 12000,
    "outputTokens": 2400
  }
}
```

## Normalized Events

The harness SDK should normalize provider streams into a small event contract,
similar to OpenAlmanac GUI:

```ts
type HarnessEvent =
  | { type: "text_delta"; content: string }
  | { type: "text"; content: string }
  | { type: "tool_use"; id?: string; tool: string; input?: string }
  | { type: "tool_result"; id?: string; content?: unknown; isError?: boolean }
  | { type: "tool_summary"; summary: string }
  | { type: "context_usage"; usage: AgentUsage }
  | { type: "error"; error: string }
  | { type: "done"; result?: string; providerSessionId?: string; costUsd?: number };
```

The process manager records these events and uses them for:

- logs
- attach/tail output
- status summaries
- cost/usage tracking
- final result reporting

## Provider Capabilities

Capabilities should be explicit metadata, not assumptions based on provider
name.

Example:

```ts
interface HarnessCapabilities {
  nonInteractive: boolean;
  streaming: boolean;
  modelOverride: boolean;
  modelOptions: boolean;
  reasoningEffort: boolean;
  sessionPersistence: boolean;
  threadResume: boolean;
  interrupt: boolean;
  fileRead: boolean;
  fileWrite: boolean;
  shell: boolean;
  mcp: boolean;
  skills: boolean;
  usage: boolean;
  cost: boolean;
  contextUsage: boolean;
  structuredOutput: boolean;
  subagents: {
    supported: boolean;
    programmaticPerRun: boolean;
    enforcedToolScopes: boolean;
  };
  policy: {
    sandbox: boolean;
    strictToolAllowlist: boolean;
    commandApproval: boolean;
    toolHook: boolean;
  };
}
```

Claude currently has stronger programmable subagent and policy support through
the Agent SDK.

Codex CLI currently has strong non-interactive execution, JSONL, model override,
sandboxing, skills/AGENTS/MCP concepts, and usage events, but should not be
treated as having the same in-memory per-run subagent contract unless the
adapter implements and tests that path.

## Non-Goals

- No proposal/apply state machine.
- No separate source/evidence pipeline.
- No TypeScript fact-extraction IR.
- No provider-specific logic in Build/Absorb/Garden.
- No committing `.almanac/runs/`.
- No fake toolsets that hide the actual base capabilities being requested.

## Summary

The final architecture should be:

```text
CLI
  -> Build / Absorb / Garden operation
    -> AgentRunSpec
      -> Process Manager
        -> Harness SDK
          -> Provider Adapter
            -> Claude / Codex / Cursor
```

The operation builds prompts and an agent run spec.

The process manager makes it a background CodeAlmanac job.

The harness SDK provides one provider-neutral agent execution interface.

Provider adapters translate that interface to Claude, Codex, Cursor, and future
harnesses.

Runs are observable, attachable, cancellable where possible, and stored as
gitignored per-wiki state.
