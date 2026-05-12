# Codex Harness Capabilities For codealmanac

Research scope: OpenAI Codex only, focused on using Codex CLI / Codex tooling as
the harness for codealmanac Build, Absorb, and Garden operations.

Primary sources:

- OpenAI Codex CLI reference: <https://developers.openai.com/codex/cli/reference>
- OpenAI Codex non-interactive mode: <https://developers.openai.com/codex/noninteractive>
- OpenAI Codex AGENTS.md guide: <https://developers.openai.com/codex/guides/agents-md>
- OpenAI Codex skills: <https://developers.openai.com/codex/skills>
- OpenAI Codex MCP: <https://developers.openai.com/codex/mcp>
- OpenAI Codex config basics: <https://developers.openai.com/codex/config-basic>
- OpenAI Codex subagents: <https://developers.openai.com/codex/subagents>
- OpenAI Codex auth: <https://developers.openai.com/codex/auth>
- OpenAI Codex approvals/security: <https://developers.openai.com/codex/agent-approvals-security>
- OpenAI Codex models: <https://developers.openai.com/codex/models>
- OpenAI Codex SDK: <https://developers.openai.com/codex/sdk>
- Local adapter: `src/agent/providers/codex-cli.ts`
- Local prompt fallback: `src/agent/providers/prompt.ts`
- Local provider capability type: `src/agent/types.ts`
- Local operation design: `docs/plans/2026-05-08-wiki-agent-operations-and-cli-design.md`

## Executive conclusion

Use Codex as an agent harness, not as a separate application-specific runtime.
For the next codealmanac implementation, keep Build, Absorb, and Garden semantics
provider-agnostic and pass the assembled operation/source prompt to Codex through
`codex exec --json`. Treat Codex subagents, AGENTS.md, skills, MCP, and config as
official harness affordances, but do not make them the primary transport for
per-run codealmanac instructions.

Best near-term shape:

```bash
codex exec \
  --json \
  --sandbox workspace-write \
  --skip-git-repo-check \
  -C "$repo" \
  --model "$model" \
  "$assembled_prompt"
```

If the prompt is large or easier to stream from code, use stdin:

```bash
codex exec --json --sandbox workspace-write -C "$repo" -
```

`codex exec` accepts an initial prompt as a positional argument; if no prompt is
provided or `-` is used, it reads instructions from stdin. If stdin is piped and
a prompt is also provided, stdin is appended as a `<stdin>` block. This is a
good match for codealmanac's assembled prompt modules plus optional source
payload.

## Non-interactive execution

Official non-interactive surface:

- `codex exec [OPTIONS] [PROMPT]`
- alias: `codex e`
- `--json` prints JSONL events to stdout
- `--output-schema <FILE>` constrains the final response shape
- `-o, --output-last-message <FILE>` writes the final assistant message
- `-C, --cd <DIR>` sets the working root
- `--add-dir <DIR>` grants additional writable roots
- `--sandbox read-only|workspace-write|danger-full-access` chooses command
  sandboxing
- `--ask-for-approval never` is the practical non-interactive approval policy
  when no human should be prompted
- `--skip-git-repo-check` allows execution outside a git repo
- `--ephemeral` avoids persisting session files to disk
- `--ignore-user-config` avoids loading `$CODEX_HOME/config.toml` while still
  using `CODEX_HOME` for auth
- `--ignore-rules` avoids user/project execpolicy `.rules`

For codealmanac:

- Use `--json` and parse JSONL. The existing local `runJsonlCli` shape is the
  right direction.
- Use `--sandbox workspace-write`, not `danger-full-access`, for Build, Absorb,
  and Garden because the intended writes are repo-local `.almanac/` edits.
- Consider `--add-dir` only if a source lives outside the repo and must be read
  or written. Prefer resolving/copying external source text into the prompt or a
  read-only temp file to avoid broad write scope.
- Use `--output-schema` only for the final operation summary, not for wiki page
  content. Page edits should remain normal filesystem edits made by the agent.
- Continue setting `CODEALMANAC_INTERNAL_SESSION=1` in the environment to let
  hooks avoid recursive capture.

Current local code already matches the core shape:

- `src/agent/providers/codex-cli.ts` calls `codex exec --json --sandbox
  workspace-write --skip-git-repo-check -C <cwd>`.
- It supports `--model`.
- It parses `item.completed`, `turn.completed`, `turn.failed`, and `error`.
- It marks Codex as `supportsUsage: true`, `supportsCost: false`, and
  `supportsProgrammaticSubagents: false`.

## Reusable guidance: AGENTS.md, skills, MCP, config

Codex has official concepts worth reusing, but they solve different layers.

### AGENTS.md

AGENTS.md is for durable project/user instructions. Codex loads instructions
from global and project AGENTS files and combines them with the run prompt. This
is the right place for coding norms, repo conventions, and stable project-level
behavior. It is not the best place for a per-run Absorb source, a git diff, or a
transcript-specific objective.

Recommendation:

- Do not write or mutate AGENTS.md from codealmanac operations.
- If a repo already has AGENTS.md, let Codex load it naturally.
- Keep codealmanac's committed wiki conventions in `.almanac/README.md`; tell
  the agent to read it.
- Do not duplicate `.almanac/README.md` into AGENTS.md. The wiki guide is part
  of the product, not a Codex-only instruction file.

### Skills

Codex skills are reusable bundles of instructions and optional assets/scripts.
They are a good official fit for reusable "how to perform this workflow" guides.
However, they are Codex-specific and are selected by the harness/model, not a
portable provider-agnostic contract.

Recommendation:

- Do not make skills the primary Build/Absorb/Garden transport.
- A future optional Codex skill could teach a human-driven Codex session how to
  maintain `.almanac/`, but `almanac absorb/build/garden` should assemble its
  own prompt modules so Claude, Codex, Cursor, and future providers receive the
  same operation semantics.
- Source-specific guidance should behave "like a skill" conceptually, but live
  in codealmanac prompt modules.

### MCP

Codex supports MCP servers. MCP is best for tools and dynamic context, not for
static per-run guidance. A local `.almanac` MCP server would be a strong future
fit: expose `search`, `show`, graph traversal, health, and perhaps read-only
topic/file-reference queries to any agent harness.

Recommendation:

- Do not require MCP for the first Codex adapter.
- Consider MCP later as an optional provider-neutral read/query interface over
  `.almanac/index.db`.
- Keep write authority in the normal filesystem path: agents edit
  `.almanac/pages/*.md`; codealmanac reindexes afterward.

### Config

Codex config lives in TOML and can be overridden with repeated
`-c key=value` flags. Config owns model defaults, sandbox defaults, approval
policy, features, MCP servers, and related harness settings.

Recommendation:

- Let users keep their normal Codex config.
- Use explicit CLI flags for codealmanac-critical behavior: cwd, JSONL,
  sandbox, model override when configured by codealmanac.
- Avoid mutating `~/.codex/config.toml` during codealmanac setup unless the user
  explicitly asks for a Codex-specific integration.

## Subagents

Codex has official subagent support in the CLI/app. Subagents can be spawned by
prompt instruction, run independently, and report back. Codex also supports
custom agents defined under locations such as user/project `.codex/agents/`
using TOML with fields like name, description, and developer instructions, plus
optional model/sandbox/MCP/skill settings.

This is useful but not equivalent to Claude Agent SDK subagents.

Claude Agent SDK, as used by codealmanac's current design, accepts an in-memory
`agents` map and exposes an `Agent` tool with enforceable subagent tool
allowlists. That lets codealmanac define a read-only reviewer subagent
programmatically. The Codex CLI subagent surface is primarily prompt/config
driven: the parent agent can be told to spawn subagents, and custom agent files
can define reusable roles, but the current codealmanac CLI adapter should not
claim a Claude-equivalent programmable subagent primitive unless it actually
owns those Codex custom-agent files or moves to an SDK surface that exposes the
needed contract.

Recommendation:

- Keep `supportsProgrammaticSubagents: false` for the `codex exec` adapter.
- Keep the existing prompt fallback: when reviewer subagents are unavailable,
  inline the reviewer rubric and instruct Codex to perform a reviewer pass
  itself before final edits.
- Optionally add a Codex-specific enhancement later:
  - detect configured `.codex/agents/reviewer.toml` / explorer agents;
  - tell the parent prompt to spawn them when available;
  - still keep a self-review fallback.
- Do not build a TypeScript propose/review/apply state machine to compensate
  for subagent differences. That violates codealmanac's "intelligence in
  prompts, not pipelines" rule.

## Source-guidance recommendation

Build, Absorb, and Garden should assemble provider-agnostic prompt modules:

```text
wiki doctrine
+ operation prompt: build | absorb | garden
+ source guidance: session | session-codex | file-folder | git-diff | pr-issue
+ reviewer rubric
+ concrete source pointers or source text
+ instruction to read .almanac/README.md and relevant existing pages
```

For Codex, pass this whole bundle as the `codex exec` prompt or stdin. Do not
encode source-specific guidance as AGENTS.md, Codex skills, or MCP resources.

Reasoning:

- Source guidance is dynamic per invocation.
- The same operation should work across providers.
- Codealmanac should own operation semantics; provider harnesses own execution.
- AGENTS.md and skills are durable Codex context, not the right carrier for
  one transcript, one git diff, or one source folder.
- MCP is a tool/context protocol, not the simplest transport for per-run
  instructions.

Concrete source handling:

- Session source: prompt includes source path(s), source app type, and guidance
  such as "start from the session, extract durable knowledge, verify against
  repo/wiki when useful."
- Codex session source: include Codex JSONL-specific reading guidance from
  `guides/processing/codex.md`; tell the agent which records are signal and
  which are noise.
- File/folder source: include resolved path inventory and guidance that the
  target is a starting lens, not a boundary.
- Git diff source: include diff summary or command instructions for read-only
  git inspection; tell the agent to update pages made stale by the change.

## Auth, model, sandbox, output, cost, permissions

### Auth

Codex supports local login through `codex login`. Non-interactive/automation
flows can use Codex auth state or API-key-based auth depending on environment.
`codex login status` is the right readiness probe for local CLI usage. The
current codealmanac adapter already checks `codex login status`.

Recommendation:

- Keep provider credentials out of codealmanac config.
- Keep `almanac agents list` / `doctor` probing `codex login status`.
- For CI/server use, document Codex's supported API-key auth path separately
  from local desktop auth.

### Model selection

Codex accepts `--model <MODEL>` / `-m <MODEL>` and config defaults. Current
OpenAI Codex model guidance changes over time, so codealmanac should not hard
code a stale Codex model unless it is intentionally pinned. The adapter should
continue treating Codex default model as provider-owned (`defaultModel: null`)
unless the user configures `agent.models.codex`.

Recommendation:

- Preserve current provider-default behavior.
- Let `almanac agents model codex <model>` pass through to `--model`.
- Avoid repo docs that name one Codex model forever. If docs mention examples,
  mark them as examples.
- For future operation routing, allow cheaper/faster models for source
  extraction or subagents only after the adapter has a real multi-run strategy.

### Sandbox and approvals

For codealmanac writes, Codex needs workspace writes but not full machine
access.

Recommendation:

- Default to `--sandbox workspace-write`.
- Use `--ask-for-approval never` for background/non-interactive hooks if needed
  to prevent blocking. In current local help, failures are returned to the model
  under `never`.
- Avoid `--dangerously-bypass-approvals-and-sandbox`.
- Avoid `danger-full-access` unless an external runner already provides a
  stronger sandbox and the user explicitly chooses it.

### JSONL output and usage

`--json` prints event JSONL. Codex emits lifecycle and item events, including
final turn events. Local observed/current adapter behavior:

- `item.completed` with `item.type === "agent_message"` can carry final text.
- `turn.completed` carries success and `usage`.
- `turn.failed` / `error` indicate failure.
- Usage includes token counts such as input, cached input, output, and reasoning
  output tokens when present.

Recommendation:

- Keep storing raw JSONL logs for debugging.
- Normalize usage into the provider-agnostic `AgentUsage` shape.
- Do not promise USD cost for Codex CLI runs unless Codex emits it. Current
  local adapter correctly reports `supportsCost: false`.
- Use `--output-schema` for operation outcome summaries if codealmanac needs
  stable machine-readable final reports. Do not force page content through JSON.

### Tool permissions

Codex CLI permissioning is harness-level: sandbox mode, approvals, execpolicy,
MCP tool configuration, and possibly custom-agent settings. The current
`codex exec` adapter does not have a Claude-style strict allowlist for built-in
Read/Edit/Bash tools.

Recommendation:

- Keep `supportsStrictToolAllowlist: false` for Codex CLI.
- Use sandbox scope and prompt instructions to bound behavior.
- If stricter reviewer enforcement becomes mandatory, implement it only through
  a documented Codex custom-agent/SDK mechanism or by running a separate
  read-only Codex invocation for review. Do not pretend prompt-only review is
  enforceably read-only.

## Limitations vs Claude Agent SDK

Codex CLI advantages:

- Official non-interactive CLI harness.
- JSONL event stream.
- Local auth and config align with Codex users' normal workflow.
- Strong enough filesystem/shell harness for wiki edits.
- Official AGENTS.md, skills, MCP, config, and subagent concepts.
- Good fit for codealmanac's "provider CLI/SDK is the harness" direction.

Codex CLI limitations relative to Claude Agent SDK:

- No current codealmanac-owned in-memory `agents` map equivalent.
- No Claude-style programmatic `Agent` tool contract in the existing adapter.
- No enforced read-only reviewer subagent in the existing adapter.
- No strict built-in tool allowlist exposed through the local provider
  capability model.
- No USD cost reporting in current local JSONL parsing.
- Session IDs/thread IDs may exist in Codex events, but the current adapter
  marks `supportsSessionId: false`; do not rely on stable session resume until
  implemented and tested.
- JSONL event shape is less typed in the local code than the Claude SDK stream.

The newer `@openai/codex-sdk` is worth tracking. It may become the better
adapter when codealmanac needs persistent threads, richer lifecycle control, or
a documented programmable subagent interface. For now, `codex exec --json` is
the pragmatic baseline.

## Recommended adapter shape

Provider-agnostic layer:

```ts
type WikiOperation = "build" | "absorb" | "garden";

interface WikiSource {
  kind:
    | "repo"
    | "session"
    | "file"
    | "folder"
    | "git-diff"
    | "pr"
    | "issue"
    | "document";
  paths?: string[];
  sourceApp?: "codex" | "claude" | "cursor" | "generic";
  inlineText?: string;
  metadata?: Record<string, unknown>;
}

interface PromptBundle {
  systemPrompt: string;
  operationPrompt: string;
  sourceGuidance: string[];
  reviewerPrompt?: string;
  userPrompt: string;
}

interface HarnessPolicy {
  cwd: string;
  writableRoots: string[];
  sandbox: "read-only" | "workspace-write";
  model?: string;
  approvalPolicy?: "never" | "on-request" | "untrusted";
  outputSchemaPath?: string;
}

interface WikiAgentResult {
  success: boolean;
  finalMessage: string;
  changedFiles: string[];
  rawLogPath?: string;
  usage?: {
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
    reasoningOutputTokens?: number;
  };
  costUsd?: number;
  warnings: string[];
}
```

Codex-specific layer:

```ts
interface CodexCliOptions {
  executable: "codex";
  args: string[];
  env: NodeJS.ProcessEnv;
  parseJsonlEvent(event: Record<string, unknown>): void;
}
```

Codex adapter responsibilities:

- Build argv for `codex exec`.
- Pass assembled prompt as argv or stdin.
- Set cwd and environment.
- Preserve user Codex auth/config unless explicitly overridden.
- Parse JSONL into normalized result, final text, usage, warnings, and errors.
- Write raw logs.
- Report capabilities accurately:
  - `transport: "cli-jsonl"`
  - `writesFiles: true`
  - `supportsModelOverride: true`
  - `supportsStreaming: true`
  - `supportsUsage: true`
  - `supportsCost: false`
  - `supportsProgrammaticSubagents: false` for this CLI adapter
  - `supportsStrictToolAllowlist: false`

Do not put provider-specific concepts into the operation model. Build/Absorb/
Garden should not know whether Codex received its guidance through argv, stdin,
AGENTS.md, or a future SDK. They should produce a prompt bundle and policy; the
provider adapter decides how to run it.

## Implementation notes for current code

The current local Codex provider is close to the recommended baseline:

- `src/agent/providers/codex-cli.ts` already shells out to `codex exec --json`.
- It already uses `--sandbox workspace-write`.
- It already forwards model overrides.
- It already records Codex as usage-capable and cost-incapable.
- `src/agent/providers/prompt.ts` already inlines reviewer guidance for
  providers without programmatic subagents.

Likely next improvements:

1. Pass prompt through stdin for very large assembled prompts and source
   payloads, avoiding shell argv length issues.
2. Add `--ask-for-approval never` for background hook runs if interactive
   approval could block capture.
3. Add optional `--output-schema` for the final operation summary.
4. Improve JSONL parsing for session/thread IDs if Codex event stability is
   confirmed.
5. Add a Codex-specific custom-agent enhancement only after testing official
   `.codex/agents/*.toml` behavior in `codex exec`.
6. Consider `@openai/codex-sdk` only if it materially improves lifecycle
   control or exposes a cleaner programmable subagent/tool contract.
