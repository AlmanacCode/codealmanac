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
---

# Wiki Lifecycle Operations

V1 names the AI write surface as three product operations: Build, Absorb, and Garden. The [[lifecycle-cli]] expresses user intent, but the operation layer owns wiki semantics and constructs the provider-neutral `AgentRunSpec` that [[process-manager-runs]] executes through [[harness-providers]].

## Operation meanings

Build creates the first useful wiki for a repo. It is exposed as `almanac init` and documented in [[build-operation]].

Absorb improves the wiki from bounded starting context. `almanac capture` calls Absorb with coding-session transcript context; [[ingest-operation]] (`almanac ingest <file-or-folder>`) calls the same operation with user-provided file or folder context. Absorb is not a public command name.

Garden improves the wiki as a whole graph. `almanac garden` gives the agent the existing `.almanac/` graph and asks for merge, split, archive, relink, retopic, and no-op judgment without a session-specific source. Those graph-shape outcomes are the editorial layer described in [[wiki-organization-primitives]].

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
