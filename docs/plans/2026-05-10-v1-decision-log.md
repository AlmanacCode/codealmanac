# V1 Decision Log

This log records design choices and tradeoffs during the V1 harness/process
refactor.

## 2026-05-10 Branch And Plan Setup

Decision: Use branch `v1` for the rewrite.

Context: User requested a new branch named `v1` if available, otherwise an
alternate such as `v2`. Local/remote `v2` already existed; `v1` was free.

Alternatives:
- Use existing `v2`.
- Use a prefixed branch such as `codex/v1`.

Why: The user explicitly asked for the `v1`/`v2` naming scheme. `v1` was
available and clearer for this rewrite.

Consequences: Branch `v1` now tracks `origin/v1`.

## 2026-05-10 Planning Scope

Decision: Treat this as a breaking architecture rewrite, not an incremental
compatibility refactor.

Context: User stated no one is using the codebase and asked not to preserve old
architecture just to fit existing code.

Alternatives:
- Incrementally adapt current `bootstrap` and `capture`.
- Keep hardcoded writer/reviewer and wrap it with new names.

Why: The new architecture requires clean boundaries: operations, process
manager, harness SDK, provider adapters, and simple prompt assembly.

Consequences: Implementation should delete stale architecture where it conflicts
with the new model.

## 2026-05-09 19:47 PDT

Decision: Add harness provider registry with placeholder adapters before porting
Claude and Codex.

Context: The new operation/process layers need a stable provider-neutral
registry and capability model before real provider ports are implemented.

Alternatives:
- Port Claude immediately while defining the registry.
- Reuse `src/agent/providers/*` directly.

Why: Placeholder adapters let the project compile and test the new boundary
without mixing old `RunAgentOptions` semantics into `AgentRunSpec`.

Consequences: Any command using the new harness before provider ports land will
fail clearly with "not implemented yet." Real Claude/Codex behavior lands in the
provider adapter phase.

## 2026-05-09 19:58 PDT

Decision: Background launches write a `queued` run record before spawning the
detached child. The child then rehydrates the spec and owns the transition to
`running`, `done`, or `failed`.

Context: If the parent spawned the child first and then wrote a `running`
record, a fast child could complete and write `done` before the parent wrote its
late `running` record, regressing the final status.

Alternatives:
- Parent writes `running` after spawn with the child PID.
- Parent writes `running` before spawn with PID `0`.
- Add a larger process supervisor before the CLI job path exists.

Why: `queued` keeps jobs visible immediately, avoids a parent/child record write
race, and lets the foreground process manager remain the single owner of actual
harness execution.

Consequences: A just-started background job may briefly show as `queued` until
the child begins. PID visibility comes from the child-owned `running` record
rather than the parent start response.

## 2026-05-09 20:03 PDT

Decision: The Claude harness adapter maps CodeAlmanac `tools` to both Claude
SDK `tools` and `allowedTools`.

Context: Claude SDK docs distinguish availability (`tools`) from auto-approval
(`allowedTools`). The old adapter only set `allowedTools`, which could be
mistaken for a strict capability boundary.

Alternatives:
- Continue setting only `allowedTools`.
- Use the full Claude Code preset and rely on prompts for tool discipline.
- Build a separate CodeAlmanac permission hook before the provider port.

Why: Passing the same mapped tool list to `tools` and `allowedTools` gives the
main agent a concrete available tool surface while keeping background runs
non-interactive with `permissionMode: "dontAsk"`.

Consequences: Tool registry entries remain provider-neutral, but the Claude
adapter is now responsible for name expansion such as `search` to `Glob`/`Grep`
and `web` to `WebSearch`/`WebFetch`. MCP server configs are passed through, but
specific MCP tool names are not invented by the registry.

## 2026-05-09 20:06 PDT

Decision: The Codex V1 adapter uses `codex exec --json` and rejects per-run
programmatic `agents`.

Context: The Codex CLI has official subagents and custom-agent concepts, but
the simple non-interactive `exec` path does not expose a Claude-equivalent
in-memory `agents` map with enforced per-agent tool scopes.

Alternatives:
- Inline requested agents into the prompt as a fallback.
- Generate `.codex/agents/*.toml` files per run.
- Wait for a fuller Codex app-server/thread lifecycle integration before
  supporting Codex agents.

Why: The V1 provider layer should report and enforce the actual primitive it can
control. `codex exec --json` is enough for Build/Absorb/Garden filesystem work,
but pretending it supports Claude-style per-run agents would make the abstraction
misleading.

Consequences: Operation builders should only include `agents` when the selected
provider capability supports `programmaticPerRun`. Codex still gets the same
assembled prompt/system text and can use its own configured harness features.
