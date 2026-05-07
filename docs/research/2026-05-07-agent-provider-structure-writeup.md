# Agent Provider Structure Write-up

Date: 2026-05-07

This write-up summarizes the provider review, the comparison with
`../openalmanac/gui`, and the follow-up research captured in
`docs/research/2026-05-07-agent-provider-cli-implementation.md`.

## Short Answer

The current `codealmanac` provider implementation is operationally defensive,
but it is not yet cleanly abstracted.

It is defensive in the practical CLI sense: malformed config falls back to
defaults, missing binaries and auth failures become readable errors, status
checks have timeouts, and `bootstrap` / `capture` fail before invoking an agent
when provider selection or auth readiness is bad.

The weaker boundary is semantic. `RunAgentOptions` currently presents one
provider-neutral contract with fields such as `allowedTools` and `agents`, but
Claude, Codex, and Cursor do not support those semantics equally. Claude can
receive SDK-level tool and subagent options. Codex and Cursor are CLI JSONL
adapters, so reviewer behavior is prompt-level fallback and tool restrictions
are not enforced through the same interface.

The code is not a mess. It is at the point where the next provider feature
should come with a small adapter refactor instead of more branching inside
`src/agent/sdk.ts`.

## What Looked Good

- AI access is still scoped to the intended commands: `bootstrap` and
  `capture`.
- Auth is checked before expensive or write-capable agent runs.
- Claude subscription auth and `ANTHROPIC_API_KEY` are both supported.
- Codex and Cursor binary/auth failures are converted into normal CLI errors.
- Config parsing is tolerant of bad or missing `~/.almanac/config.json`.
- The full test suite was green after pulling the provider work.

## Main Smells

### Provider semantics are hidden behind one shape

`src/agent/sdk.ts` exposes `allowedTools` and `agents` as if they are generic
provider options. In reality:

- Claude has a real SDK path with programmatic subagent definitions.
- Codex currently uses `codex exec --json`.
- Cursor currently uses `cursor-agent --print --output-format stream-json`.

The Codex and Cursor paths do not receive Claude-style nested reviewer agents,
and they should not claim strict per-run tool allowlist enforcement unless a
future official CLI surface proves that capability.

### The runner module is becoming a mixed dispatcher

`src/agent/sdk.ts` now owns:

- Claude SDK setup and result parsing.
- Codex CLI argument construction.
- Cursor CLI argument construction.
- Shared JSONL subprocess handling.
- Provider-specific final event parsing.
- Reviewer fallback prompt construction.

That is still readable, but it is the wrong growth direction. Provider-specific
logic should live in provider adapters.

### Provider adapter behavior needs direct tests

Most command tests inject a fake `runAgent`, which is good for command wiring.
It does not prove the Codex and Cursor JSONL adapters parse real event streams,
handle subprocess close/error behavior, or construct the right CLI args.

### Config ownership is muddled

`src/update/config.ts` now owns both update-notifier config and agent-provider
config. It works, but the module name no longer matches the responsibility.
Provider config should eventually move under a more general config module or an
agent/provider module.

## What The OpenAlmanac GUI Shows

In the OpenAlmanac GUI report and local provider code, the provider boundary is
cleaner than `codealmanac`'s current implementation.

Relevant GUI files:

- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/service.js`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/claude-adapter.js`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/main/domains/providers/codex-adapter.js`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/shared/providers/runtime-events.d.ts`
- `/Users/rohan/Desktop/Projects/openalmanac/gui/src/domains/providers/models.ts`

The GUI uses a service / adapter / capabilities / event-contract pattern:

- `service.js` is the facade and registry.
- Each adapter owns its provider's auth, models, option building, runtime
  start, and message normalization.
- Provider metadata includes explicit capabilities such as context usage,
  reasoning effort, warm sessions, thread resume, model switching, and
  attachments.
- The provider stream contract is provider-neutral and lives in `shared/`.

The important lesson is not to copy the GUI's full size. The GUI has persistent
chat sessions, warm Claude sessions, renderer-facing state, and app-server
Codex integration. `codealmanac` only needs `bootstrap` and `capture`.

The right thing to copy is the honesty of the boundary: adapters declare what
they can do, and shared runtime code checks capabilities instead of assuming
all providers behave like Claude.

## Recommended Codealmanac Shape

Keep `runAgent()` as the public facade so `bootstrap` and `capture` do not need
large changes, but move provider details behind adapters.

Suggested layout:

```text
src/agent/
  types.ts
  sdk.ts                    # optional compatibility facade, or rename later
  providers/
    index.ts                # registry + getProvider()
    claude.ts               # Anthropic Agent SDK adapter
    codex-cli.ts            # codex exec adapter
    cursor-cli.ts           # cursor-agent adapter
    jsonl-cli.ts            # shared JSONL subprocess runner
    status.ts               # binary/auth status helpers
```

Suggested interface:

```ts
export interface AgentProviderCapabilities {
  transport: "sdk" | "cli-jsonl";
  supportsStrictToolAllowlist: boolean;
  supportsProgrammaticSubagents: boolean;
  supportsStreamingText: boolean;
  supportsFinalUsageCost: boolean;
  supportsProviderReportedTurns: boolean;
  supportsTokenUsage: boolean;
  supportsSessionId: boolean;
  supportsModelOverride: boolean;
  supportsReasoningEffort: boolean;
}

export interface AgentProviderMetadata {
  id: AgentProviderId;
  displayName: string;
  defaultModel: string | null;
  capabilities: AgentProviderCapabilities;
}

export interface AgentProvider {
  metadata: AgentProviderMetadata;
  checkStatus(): Promise<ProviderStatus>;
  run(opts: RunAgentOptions): Promise<AgentResult>;
}
```

Initial capability truth:

- Claude: SDK transport, model overrides, streaming, cost/turn/session result,
  and programmatic reviewer subagents. Strict tool policy should only be
  claimed if implemented with the correct SDK permissions, not by name alone.
- Codex: CLI JSONL transport through `codex exec --json`, model override,
  streaming/final result parsing, token usage when emitted, no Claude-style
  subagent contract, no strict per-run tool allowlist, and no Claude-style USD
  cost/turn result contract.
- Cursor: CLI JSONL transport through `cursor-agent --print --output-format
  stream-json`, model override, streaming/final result parsing, token usage
  when emitted, no Claude-style subagent contract, no strict per-run tool
  allowlist, and no Claude-style USD cost/turn result contract.

## Provider-specific Implementation Notes

### Claude

Keep Claude on `@anthropic-ai/claude-agent-sdk`. This remains the full-fidelity
provider for `codealmanac` because it supports the writer/reviewer shape
directly.

Preserve:

- `claude auth status --json` plus `ANTHROPIC_API_KEY` fallback.
- Full model ids such as `claude-sonnet-4-6`.
- `includePartialMessages: true`.
- SDK result normalization for cost, turns, result, error, and session id.
- Programmatic reviewer subagent definitions.

Clarify:

- `allowedTools` is not a generic provider capability.
- If the project needs strict Claude tool policy, use the appropriate SDK
  permission controls rather than relying on a misleading option name.

### Codex

Use `codex exec` for the CLI package. Do not copy the GUI's Codex app-server
path into `codealmanac` unless the CLI grows persistent interactive runtime
needs.

Recommended shape:

```bash
codex exec --json --sandbox workspace-write --ask-for-approval never --skip-git-repo-check -C <repo-root> <combined-prompt>
```

Research notes:

- `codex login status` is the right auth readiness probe.
- `--json` emits newline-delimited JSON events.
- `--model` is supported.
- Reasoning effort should not be added as a first-class option unless current
  CLI help or official docs expose a supported non-interactive mechanism.
- Do not claim Claude-style `agents` support through `codex exec`.

### Cursor

Use `cursor-agent --print` with stream JSON.

Recommended shape:

```bash
cursor-agent --print --output-format stream-json --stream-partial-output --trust --workspace <repo-root> <combined-prompt>
```

Research notes:

- `cursor-agent status` / `whoami` is the auth readiness probe, with timeout.
- `--model` is supported.
- `--trust` is needed for non-interactive workspace execution.
- The final stream event is a `result` object with success/error fields.
- Do not claim Claude-style `agents` support or strict tool allowlisting.

## Test Plan

Add focused adapter tests before or during the refactor:

- Fake `codex` and `cursor-agent` binaries on `PATH`; assert exact args.
- Feed fixture JSONL for Codex success, Codex failure, Cursor success, and
  Cursor failure.
- Test subprocess error, non-zero exit, trailing invalid JSON, and timeout
  behavior.
- Test provider metadata so Claude is the only provider marked as supporting
  programmatic subagents.
- Keep command-level tests with fake `runAgent`, but do not rely on them as
  adapter coverage.

Manual smoke tests should capture real CLI JSONL fixtures from a machine with
current Codex and Cursor login states.

## Recommendation

Refactor before adding more provider behavior.

This should be a small structural change, not a new orchestration pipeline.
The writer still owns the outcome. There should be no propose/apply flow, no
dry run, and no state machine between writer and reviewer.

The next implementation slice should:

1. Introduce provider metadata and capabilities.
2. Split Claude, Codex, and Cursor into adapters.
3. Keep the existing `runAgent()` facade.
4. Make Codex/Cursor reviewer behavior explicitly prompt-level fallback.
5. Add adapter-level JSONL and CLI arg tests.

That gives `codealmanac` the same honest provider boundary as the
OpenAlmanac GUI, scaled down for a local CLI.
