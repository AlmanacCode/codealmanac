---
title: Agentmemory Competitor
summary: Agentmemory is a serious adjacent memory product whose event-driven daemon competes with CodeAlmanac's memory-continuity promise but not its repo-owned wiki artifact.
topics: [product-positioning]
files:
  - docs/strategy/codealmanac-vs-deepwiki-supermemory.md
  - docs/research/karpathy-llm-wiki.md
  - README.md
sources:
  - /Users/rohan/.codex/sessions/2026/05/15/rollout-2026-05-15T01-30-45-019e2a1d-a038-7633-81ea-a1dfc6cb50bd.jsonl
  - https://github.com/rohitg00/agentmemory
  - https://github.com/iii-hq/iii
  - https://iii.dev/docs/0-10-0/architecture/workers
  - https://workers.iii.dev/
  - /Users/rohan/Desktop/Projects/agentmemory/README.md
  - /Users/rohan/Desktop/Projects/agentmemory/src/index.ts
  - /Users/rohan/Desktop/Projects/agentmemory/src/hooks/post-tool-use.ts
  - /Users/rohan/Desktop/Projects/agentmemory/src/functions/context.ts
  - /Users/rohan/Desktop/Projects/agentmemory/src/functions/observe.ts
verified: 2026-05-15
---

`agentmemory` is a persistent memory engine for AI coding agents. Its public package is `@agentmemory/agentmemory`, and the cloned repo at `../agentmemory` was inspected at commit `4b354b7` on 2026-05-15. Its README describes support for Claude Code, Cursor, Gemini CLI, Codex CLI, OpenClaw, Hermes, OpenCode, MCP clients, and REST clients.

## How It Works

`agentmemory` is an online memory daemon. Its hook path sends coding-agent events to `POST /agentmemory/observe`, and its function layer stores observations, compresses them into facts and concepts, indexes BM25 and optional vector embeddings, and exposes memory through MCP, REST, and startup context injection. `src/functions/context.ts` emits an `<agentmemory-context>` block with a token budget so future sessions can receive memory without an explicit search step.

`agentmemory` stores memory under a user-level `~/.agentmemory` data directory through iii-engine state. The artifact is memory state, not a repo-local markdown page set.

CodeAlmanac is an offline repo wiki compiler. [[capture-flow]] waits for quiet Claude or Codex transcripts, runs an Absorb job through [[wiki-lifecycle-operations]], and lets an agent edit `.almanac/pages/*.md` and `.almanac/topics.yaml` directly against the repo's notability rules. Query-time retrieval is explicit: future agents run `almanac search --mentions src/foo`, `almanac search "<query>"`, and `almanac show <slug>` before changing related code.

## iii Runtime Shape

`iii` is the backend runtime under agentmemory, not a small helper library. Its model is a WebSocket-connected engine where workers register named functions, triggers invoke those functions, and shared primitives provide KV state, HTTP triggers, streams, queues, cron, and OpenTelemetry traces. Agentmemory registers itself as an iii worker in `src/index.ts`, then registers memory functions such as `mem::observe`, `mem::context`, `mem::smart-search`, `mem::remember`, and `mem::forget`.

The code shape follows that runtime. `src/index.ts` imports `registerWorker` from `iii-sdk`, creates a worker against `config.engineUrl`, builds a `StateKV` wrapper over the SDK, then calls a long list of `register*Function` helpers. Individual function modules call `sdk.registerFunction("mem::<name>", handler)` and trigger other functions by string id. The result feels like a capability registry on an engine bus rather than a conventional Node CLI or library.

The iii bet gives agentmemory composition surfaces that CodeAlmanac does not have: MCP and REST tools route to the same function ids, viewer streams come from iii streams, scheduled jobs can route through cron workers, and other languages can call memory operations through iii SDKs over `ws://localhost:49134`. It also makes agentmemory heavier than a repo-local tool: users need a separate native `iii-engine` binary or Docker, agentmemory pins `iii-engine` to `v0.11.2` in its README, and debugging spans the engine, worker, REST, stream, and KV layers.

This is the sharpest architectural contrast. Agentmemory plus iii is a live local backend platform for memory. CodeAlmanac is a CLI that writes reviewable wiki source files and derives `.almanac/index.db` from them.

## Karpathy LLM Wiki Relation

Agentmemory's README says its gist extends Karpathy's LLM Wiki pattern with confidence scoring, lifecycle, knowledge graphs, and hybrid search. The shared idea is that memory should compound instead of re-deriving context from raw history on every question.

The implementation paths differ. [[docs/research/karpathy-llm-wiki.md]] describes an LLM-maintained persistent markdown wiki: raw sources are read once, entity pages and synthesis pages are updated, and links preserve the structure for later queries. CodeAlmanac is mechanically close to that pattern because its durable output is a repo-local markdown wiki. Agentmemory stretches "wiki" into a structured memory store made of observations, summaries, facts, lessons, graph edges, confidence scores, embeddings, and injected context.

The overlap with [[company-brain]] is broad memory continuity across coding sessions. The overlap with CodeAlmanac is strongest when `agentmemory` stores architecture choices, bug fixes, file context, and workflows from prior coding sessions.

CodeAlmanac remains differentiated only if it stays repo-native and governed. The durable artifact is `.almanac/pages/` plus `.almanac/topics.yaml`, not a user-level memory database. Pages are markdown, reviewable in Git, tied to `files:` frontmatter, searchable through `almanac search --mentions`, and maintained against a repo-specific notability bar.

`agentmemory` is a serious adjacent product, not a direct replacement for CodeAlmanac's current thesis. It competes with "agents remember everything" positioning. It does not replace a repo-owned wiki unless it adds a committed, reviewable, notability-governed artifact that agents consult before editing files.

The practical positioning rule is: `agentmemory` remembers what agents did; CodeAlmanac preserves what this codebase has learned.

## Product Lesson

The honest product gap is activation, not wiki quality. CodeAlmanac's pages are higher-signal and more governable than an event-memory stream, but the current workflow depends on the next agent remembering to search and read the right page. Agentmemory's stronger mechanic is automatic capture plus automatic retrieval or injection at session start.

The target product experience should be automatic surfacing without automatic believing. A future CodeAlmanac runtime should notice the files or commands an agent is about to touch, surface a small cited set of relevant constraints, decisions, and gotchas, and let the agent drill into the full wiki page when needed. The durable source should remain the repo-owned wiki; any session-local observation cache should be a retrieval aid, not the canonical project memory.

This keeps the differentiation sharp. CodeAlmanac should not become generic context stuffing. It should become [[just-in-time-context-surfacing]] for coding agents: file-aware, evidence-linked, constraint-oriented, and followed by Absorb writeback when a session produces reusable project understanding.
