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
  - /Users/rohan/.codex/sessions/2026/05/28/rollout-2026-05-28T18-27-05-019e70e9-b7d7-7900-9fc0-da2a6f0b532d.jsonl
verified: 2026-05-28
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

## Provenance and protection policy

The 2026-05-28 capture-sweep incident made one cross-operation requirement explicit: automated write operations need provenance, ownership, and protection boundaries before they invoke an LLM or mutate wiki state. [[capture-automation]] applies the observed fix to scheduled Absorb by excluding CodeAlmanac maintenance transcripts and reserving candidate work before token spend. The incident did not show Garden deleting protected pages; Garden enters the policy because it is the operation allowed to merge, archive, relink, and retopic wiki memory.

Absorb must distinguish user/project evidence from CodeAlmanac's own maintenance exhaust. Garden must not archive, delete, or rewrite protected Almanac-owned system memory just because it looks generated, stale, or low-quality in isolation. Build must not overwrite existing wiki structure without knowing whether pages are user-authored, system-authored, generated, protected, stale, or superseded.

A loose tag such as `almanac` is ambiguous on pages, but it is meaningful on sessions when the tag marks the session as Almanac maintenance. The user correction in the 2026-05-28 discussion was specifically about session evidence: a session tagged `almanac` should be excluded from automatic capture, not treated as user/project work. Page protection is a separate future Garden/Build policy, not the observed failure.

The durable direction is a shared lifecycle provenance policy where cheap deterministic code or persisted metadata classifies inputs and outputs before operation prompts make editorial judgments.

The policy needs to answer these questions before mutation:

- what kind of source is being processed
- who or what produced it
- whether it has already been processed
- whether another job already owns it
- whether it is protected
- whether this operation is allowed to mutate it

This does not require a full rewrite of the lifecycle architecture. It is a requirements correction: every lifecycle operation should receive classified inputs and write classified outputs, while prompts remain responsible for deciding what classified project evidence means for durable wiki memory.

## Current tool policy

All three operations currently request `read`, `write`, `edit`, `search`, and `shell`, with `maxTurns: 150`. Provider adapters translate those base tool requests into native provider capabilities. Codex may reject unsupported per-run fields rather than silently dropping them.
