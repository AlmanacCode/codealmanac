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

## 2026-05-09 20:09 PDT

Decision: Keep Cursor as future work in V1 and leave the harness adapter as an
explicit placeholder.

Context: The architecture doc says Cursor is future work and not to implement it
for this rewrite. Claude and Codex are enough to validate the provider boundary
and process manager.

Alternatives:
- Port the old `cursor-agent --print --output-format stream-json` adapter now.
- Remove Cursor from the provider registry entirely.

Why: Keeping the placeholder preserves the intended extension point without
spending implementation time on a provider that the current V1 scope explicitly
defers.

Consequences: Any Cursor run fails clearly until a later Cursor adapter lands.

## 2026-05-09 20:09 PDT

Decision: New init/build scaffolding gitignores `.almanac/runs/` instead of
`.almanac/logs/` or old root-level capture/bootstrap globs.

Context: V1 stores process records and JSONL event logs together under
`.almanac/runs/`. Separate `.almanac/logs/` state belongs to the old capture and
bootstrap architecture.

Alternatives:
- Keep ignoring both `.almanac/logs/` and `.almanac/runs/`.
- Keep the old legacy globs for backwards compatibility.

Why: The user explicitly called out that logs and runs overlap, and V1 should
make `.almanac/runs/` the single local process-state directory.

Consequences: Existing repos may still have older ignored paths, but newly
generated V1 ignore blocks only include the derived SQLite files and
`.almanac/runs/`.

## 2026-05-09 20:30 PDT

Decision: Retire public `almanac bootstrap` wiring in the V1 CLI surface.

Context: `bootstrap` is the old write-capable AI path. It bypasses the V1
operation/process/harness layers and writes old `.almanac/logs/` artifacts.

Alternatives:
- Keep `bootstrap` as a deprecated alias to `init`.
- Leave it public until a later cleanup phase.

Why: The agreed public V1 write commands are `init`, `capture`, `ingest`, and
`garden`. Keeping a second public build path would preserve architecture drift.

Consequences: The public command was removed first, then the old
`runBootstrap`, old hardcoded `runCapture`, capture-status state reader, and
the old `bootstrap`/`writer`/`reviewer` prompt files were deleted in the Phase 8
cleanup. Historical slice plans still describe that path, but V1 runtime code no
longer carries it.

## 2026-05-09 20:30 PDT

Decision: `capture` refuses to start a job when no transcript file is provided
until V1 session discovery is implemented.

Context: The first CLI wiring accepted no-arg capture and launched Absorb with
only text saying no session was provided. That created a job without the source
context the operation needs.

Alternatives:
- Keep launching and let the prompt infer what to do.
- Reuse the old Claude-only transcript resolver immediately.
- Implement full Claude/Codex/Cursor discovery in this review-fix pass.

Why: Failing clearly is safer than running an empty Absorb job. The old resolver
is Claude-specific and would reintroduce the wrong abstraction before the
provider/session discovery layer is designed.

Consequences: Explicit transcript-file capture works. No-arg/latest-session and
flag-based session discovery are a documented follow-up before V1 is complete.

Update 2026-05-09 20:33 PDT: Claude latest-session and `--session <id>`
discovery now work in the V1 command path. Codex/Cursor session discovery and
bulk filters remain explicit follow-up work.

## 2026-05-09 20:30 PDT

Decision: Codex `exec` adapter rejects unsupported per-run fields instead of
advertising and silently dropping them.

Context: Codex metadata previously said reasoning effort, MCP, skills, and
context usage were supported, but the `codex exec --json` adapter did not map
those fields.

Alternatives:
- Keep the broader capability flags for future Codex SDK/app-server support.
- Convert unsupported fields into prompt text.

Why: Provider capabilities must describe the actual adapter primitive, not the
provider ecosystem in general.

Consequences: Current Codex V1 runs support the simple exec path: prompt, cwd,
model, workspace-write sandbox, output schema, JSONL events, and usage parsing.
Future richer Codex transports can re-enable capabilities when implemented.
