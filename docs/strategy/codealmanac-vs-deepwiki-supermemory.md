# Codealmanac Differentiation: DeepWiki, Supermemory, SMFS

## Thesis

Codealmanac must not become generic AI memory or local DeepWiki. Those markets
are already credible:

- DeepWiki explains codebases from indexed code and docs, and exposes that
  understanding to agents through MCP and Ask Devin.
- Supermemory gives agents persistent memory across tools, apps, documents, and
  users.
- SMFS makes Supermemory accessible as a filesystem, which is extremely
  agent-native because agents already know `ls`, `cat`, `grep`, and `find`.

Codealmanac's durable wedge is narrower:

> A git-native living wiki for one codebase, maintained by coding agents as a
> side effect of real development, optimized for the next coding agent before it
> edits the repo.

The differentiator is not "agents can ask questions." DeepWiki and Supermemory
can both support that. The differentiator is governed, repo-owned, reviewed,
high-signal knowledge about what the code cannot say.

## Facts From Competitor Research

### DeepWiki

DeepWiki is an AI-generated codebase documentation and Q&A system. It indexes
repositories, creates architecture-oriented wiki pages, links answers back to
source, and supports Ask Devin. DeepWiki MCP exposes tools such as reading wiki
structure, reading wiki contents, and asking questions.

Implication: DeepWiki is not merely human docs retrofitted for agents. It is
agent-accessible and useful as a context oracle. An agent can formulate a
question like "How does auth work?" and ask DeepWiki instead of spending many
tokens grepping the repo.

DeepWiki's natural center is generated codebase understanding:

- architecture overviews
- source-grounded Q&A
- repo onboarding
- diagrams and summaries
- remote/hosted indexed context

### Supermemory

Supermemory is a general memory layer for AI tools, agents, and apps. It offers
memory storage, recall/search, profile/context injection, connectors, file
processing, and APIs. Its GitHub/docs describe end-user memory across tools and
developer memory/RAG/profile infrastructure for AI products.

Implication: Supermemory can store project facts, preferences, past discussions,
documents, and agent memories. If codealmanac is just "persistent repo memory,"
Supermemory can overlap heavily.

Supermemory's natural center is generic memory infrastructure:

- cross-tool user memory
- app/agent memory API
- RAG and profile layer
- cloud sync
- connectors and multimodal ingestion
- client plugins and MCP

### SMFS

SMFS mounts a Supermemory container as a real directory. Agents can use `ls`,
`cat`, `grep`, and normal filesystem tooling. Under the hood, `grep` can become
semantic search, `profile.md` is a live generated profile, and local reads/writes
sync with Supermemory. macOS uses NFSv3; Linux uses FUSE; serverless use cases
can use a Bash Tool.

Implication: SMFS validates a major codealmanac intuition: agents are fluent in
filesystem and shell interfaces. Files are a better agent interface than bespoke
SDKs when the task is context discovery.

SMFS's natural center is filesystem-shaped generic memory:

- semantic search behind `grep`
- mounted memory containers
- live profile summaries
- bidirectional sync
- "every tool can read files" ergonomics

## The Honest Threat Model

Competitors can build into codebase-governed memory.

DeepWiki could add session-updated codebase memory. Supermemory could add repo
containers, `.supermemory/config`, session capture, repo profiles, stale memory
checks, GitHub comments, and codebase templates. SMFS could mount a repo-scoped
memory folder with semantic `grep` and agent writes.

Therefore the moat is not technical impossibility. The moat must be execution,
taste, defaults, and workflow ownership.

Codealmanac loses if it becomes:

- generic memory
- loose notes
- a local RAG wrapper
- an "ask my repo" endpoint
- generated architecture docs only
- cloud memory with weaker infrastructure than Supermemory
- hosted code understanding with weaker indexing than DeepWiki

Codealmanac wins only if it becomes:

- the canonical memory artifact of a repo
- high-signal enough that agents trust it before editing
- reviewable in git
- maintained continuously by coding agents
- structured around codebase concepts, not generic memories
- governed by notability, health checks, links, and archive rules

## Positioning

Use this contrast:

> DeepWiki explains the codebase.
> Supermemory remembers across tools.
> Codealmanac preserves what this codebase has learned.

Or shorter:

> DeepWiki is code understanding.
> Supermemory is agent memory.
> Codealmanac is codebase institutional memory.

Avoid positioning codealmanac as "better RAG" or "memory for agents." Those are
too broad and invite direct comparison with stronger generic platforms.

## Codealmanac's Required Product Shape

### 1. Repo-Native, Not Account-Native

The knowledge must live in the repo under `.almanac/`, not only in a vendor
account. This matters because codebase memory should:

- move with clones
- survive tool churn
- be reviewed in PRs
- be diffed and reverted
- be available offline
- be inspected by any editor or agent
- remain readable as plain markdown

Supermemory can sync memory. DeepWiki can host repo docs. Codealmanac should be
the repo's own memory.

### 2. Maintained By Coding Sessions, Not Just Indexed

The primary write path is capture after work:

- agent completes a coding/debugging/review session
- capture reads the transcript and existing wiki
- writer updates pages directly
- reviewer critiques notability, duplication, linking, and accuracy
- user reviews normal git diff

This is the core loop. If this loop is weak, codealmanac becomes static docs.

### 3. Governed Knowledge, Not Loose Memory

Generic memory systems tend to accumulate facts. Codebase memory must be
curated. Every page should pass a notability bar:

- Will this help a future coding agent avoid rediscovery?
- Is this not obvious from reading the code?
- Does it explain why, not merely what?
- Does it connect to files, topics, flows, or decisions?
- Is it durable beyond the current task?

Bad memories are worse than no memories because agents will confidently follow
stale or vague context.

### 4. Codebase-Specific Structure

Codealmanac should double down on structures a generic memory product would not
naturally build first:

- file refs
- wikilinks
- backlinks
- topic DAG
- archive/supersede lineage
- stale page detection
- orphan detection
- dead reference checks
- page health
- codebase notability bar
- capture summaries
- local SQLite index for fast query

These are governance primitives. They turn markdown notes into a maintainable
knowledge graph.

### 5. Agent-First Retrieval, Not Human-First Browsing

The primary consumer is the next coding agent. Human readability matters, but it
is secondary. Retrieval should be optimized for task preparation:

- "What should I know before touching this file?"
- "What decisions constrain this subsystem?"
- "What past bugs happened around this flow?"
- "What pages are stale for this area?"
- "What did the last agent learn while changing this?"

DeepWiki can answer architecture questions. Codealmanac should answer pre-edit
judgment questions.

### 6. Local Trust Boundary

The local-only design is strategic, not incidental. Codebases often contain
private implementation details, incidents, customer gotchas, security decisions,
and operational constraints. Keeping memory local and git-native gives teams a
simple trust model.

Cloud integrations can come later, but they should not be required for the core
loop.

## What Codealmanac Should Be Great At

### Before Work

Prepare a coding agent with high-signal context:

- relevant pages for files it will edit
- decisions and invariants for the subsystem
- known gotchas and failure modes
- related topics and prior incidents
- stale or suspect docs to treat carefully

This is where token savings and quality improvement become real.

### During Work

Stay mostly out of the way. The CLI should help query existing knowledge, not
orchestrate the coding process. The agent should use normal tools and consult
the wiki when needed.

Important rule: do not build heavy propose/apply pipelines around the agent.
Judgment belongs in prompts and review, not TypeScript state machines.

### After Work

Capture what changed in understanding:

- new decisions
- reversed assumptions
- bugs and fixes
- constraints discovered
- cross-file flows clarified
- commands or checks that mattered
- things future agents should not repeat

This after-work write path is the biggest differentiator from DeepWiki and
generic memory.

## Product Directions That Strengthen The Wedge

### Task Context Preparation

Add a first-class way to prepare context for a task:

```text
almanac context --mentions src/auth/session.ts
almanac context "implement OAuth refresh"
```

This should output a compact bundle:

- top relevant pages
- file-linked gotchas
- decisions/invariants
- stale warnings
- suggested pages to read

Do not make this a generic chatbot. Make it a deterministic context pack over
the local wiki.

### File-Centric Memory

Agents usually know the files they are about to edit. Codealmanac should make
file-to-memory retrieval excellent:

```text
almanac search --mentions src/payments/stripe.ts
almanac show --backlinks checkout-flow
```

Future enhancement:

```text
almanac context --files src/payments/stripe.ts src/cart/checkout.ts
```

### Capture Quality Metrics

A codebase wiki needs quality pressure. Useful checks:

- duplicate page candidates
- pages with no file refs and no links
- stale pages touching active files
- pages with vague titles
- pages with too many unrelated topics
- capture outputs with no changed pages despite large code diffs

The goal is to prevent memory rot.

### Git Review Ergonomics

Make the user review wiki changes like code:

- readable markdown diffs
- small atomic pages
- clear frontmatter
- stable formatting
- no generated blobs
- no opaque binary index committed

This is a structural advantage over hosted memory.

### MCP / Filesystem Interface

DeepWiki and Supermemory make MCP/filesystem access table stakes. Codealmanac
should eventually expose agent-friendly access, but the API should reflect the
unique graph:

- `search_memory`
- `read_page`
- `related_pages`
- `pages_for_file`
- `prepare_task_context`
- `recent_learnings`
- `health_summary`
- `capture_session`

Do not expose only `ask_question`; DeepWiki already owns that shape well.

## Anti-Directions

Avoid these:

- becoming a hosted generic memory service
- prioritizing semantic search before the local graph is excellent
- storing memories outside git as the primary source of truth
- writing every session detail into memory
- generating broad architecture pages without session-learned judgment
- adding workflow state machines between writer and reviewer
- making humans manually curate every memory
- making agents learn a bespoke API when CLI/files are enough
- competing with Supermemory on multimodal ingestion
- competing with DeepWiki on generated architecture portals

## Competitive Response By Product

### If DeepWiki Improves Freshness

Freshness alone is not enough. Codealmanac should emphasize:

- git-native review
- session capture
- decisions/gotchas/invariants
- local-only private memory
- pages that explain why, not just what

### If DeepWiki Adds Agent-Written Memory

Then codealmanac must be better at governance:

- notability bar
- local markdown
- health checks
- archive/supersede
- topic/file graph
- exact command-line ergonomics for coding agents

### If Supermemory Adds Codebase Containers

Then codealmanac must be better at repo ownership:

- `.almanac/` travels with the code
- no account required
- PR review of memory changes
- codebase-specific graph primitives
- no loose fact pile

### If SMFS Adds Codebase Memory Templates

Then codealmanac should not fight the filesystem insight. It should lean into
its own filesystem-native design and make `.almanac/` the best structured
memory folder for coding agents.

## Non-Negotiable Product Principles

1. The repo owns the memory.
2. Agents are the primary reader.
3. Agents maintain the wiki after real work.
4. Humans review memory changes through git.
5. The wiki captures what code cannot say.
6. Quality beats quantity.
7. Local-first is a trust advantage.
8. Query commands stay fast and scriptable.
9. Capture/bootstrap are the only AI-writing CLI paths.
10. The graph must stay understandable without a service.

## One-Line Strategy

Build the thing a future coding agent reads before touching the repo, and the
thing the current coding agent updates after learning something worth preserving.

