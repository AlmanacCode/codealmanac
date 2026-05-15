---
title: Wiki Lifecycle Operations
summary: Build, Absorb, and Garden are Almanac's three AI write operations, and each constructs provider-neutral run specs rather than owning provider behavior directly.
topics: [agents, flows, cli]
files:
  - src/operations/build.ts
  - src/operations/absorb.ts
  - src/operations/garden.ts
  - src/operations/types.ts
  - src/commands/operations.ts
sources:
  - docs/plans/2026-05-14-provider-automation-boundary-refactor.md
  - /Users/rohan/.codex/sessions/2026/05/13/rollout-2026-05-13T23-00-06-019e246d-595d-76d3-bd45-6433245065ac.jsonl
verified: 2026-05-14
---

# Wiki Lifecycle Operations

V1 names the AI write surface as three product operations: Build, Absorb, and Garden. The [[lifecycle-cli]] expresses user intent, but the operation layer owns wiki semantics and constructs the provider-neutral `AgentRunSpec` that [[process-manager-runs]] executes through [[harness-providers]]. [[lifecycle-architecture]] is the reading map for the surrounding CLI, prompt, run-record, provider, and automation pages.

## Operation meanings

Build creates the first useful wiki for a repo. It is exposed as `almanac init` and documented in [[build-operation]].

Absorb improves the wiki from bounded starting context. `almanac capture` calls Absorb with coding-session transcript context; [[ingest-operation]] (`almanac ingest <file-or-folder>`) calls the same operation with user-provided file or folder context. Absorb is not a public command name.

Garden improves the wiki as a whole graph. `almanac garden` gives the agent the existing `.almanac/` graph and asks for merge, split, archive, relink, retopic, and no-op judgment without a session-specific source. Those graph-shape outcomes are the editorial layer described in [[wiki-organization-primitives]].

Future lifecycle work may add a verification-oriented algorithm that audits wiki claims against code, docs, prompts, tests, and history. That algorithm should differ from deterministic `health`: it would fact-check semantic claims and either edit clear truth drift or emit [[wiki-clarifications]] when the source of truth depends on missing human context.

## Algorithm framing

Build, Absorb, and Garden are product operations, but each operation is also an opinionated wiki-update algorithm encoded in prompts and operation code.

The useful first-principles framing is:

- `Build(D)` starts from a repo or document corpus `D` and an empty wiki, then writes the initial topic graph and durable pages.
- `Absorb(W, C)` starts from an existing wiki `W` and bounded new context `C`, then updates, merges, or creates pages only when `C` improves durable project memory.
- `Garden(W)` starts from an existing wiki `W`, then improves graph quality through merge, split, archive, relink, retopic, and no-op judgment.

This framing matters because Absorb is not a neutral menu of possible update strategies. It takes the project stance that bounded input is raw material to distill into the existing graph. Future work can add more algorithms, but the current operation names should be read as semantic modes with specific prompt contracts, not just commands that happen to call agents.

## Boundary

Operations choose:

- the operation prompt from [[operation-prompts]]
- runtime context text
- provider/model selection passed in by command handling
- requested base tools
- run metadata such as operation, target kind, and target paths

Operations do not know how Claude, Codex, or Cursor run. They also do not create proposal JSON, reviewer state machines, dry-run artifacts, or source/evidence pipeline objects. When judgment is needed, the prompt owns it.

## Current tool policy

All three operations currently request `read`, `write`, `edit`, `search`, and `shell`, with `maxTurns: 150`. Provider adapters translate those base tool requests into native provider capabilities. Codex may reject unsupported per-run fields rather than silently dropping them.
