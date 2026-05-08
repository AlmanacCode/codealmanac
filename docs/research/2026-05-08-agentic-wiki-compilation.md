# Agentic Wiki Compilation

## Purpose

This note captures the current formulation of the `codealmanac` ingestion and
gardening problem. It grew out of comparing three ideas:

- Karpathy's LLM-maintained wiki pattern in `docs/research/karpathy-llm-wiki.md`
- Farzapedia's absorb / cleanup / breakdown workflow in `docs/research/farzapedia.md`
- `codealmanac`'s specific goal: a repo-native wiki that preserves what the code
  cannot say for future coding agents

The core conclusion is that `codealmanac` should not treat ingestion as isolated
summarization. It should treat ingestion as contextual wiki compilation.

## The Problem

Given a large and changing corpus `D`, build and maintain a mutable wiki `W` so
that `W` is factual, coherent, navigable, well-organized, and useful to future
agents.

The corpus can contain many source types:

- source code files
- folders or whole codebase snapshots
- AI coding session transcripts
- git diffs and commit histories
- PR comments and review threads
- incidents, design docs, meeting notes, support threads
- arbitrary user-supplied files

The source may be tiny, such as one markdown note, or enormous, such as a whole
repo or many months of coding sessions. The algorithm cannot assume every input
should be processed with the same reading strategy.

The goal is not:

```text
Put every source somewhere in the wiki.
```

The goal is:

```text
Produce the best resulting wiki under a bounded attention and runtime budget.
```

This means success is measured at the wiki level, not at the source level.

Good outcomes include:

- creating new pages
- updating canonical pages
- merging overlapping pages
- splitting bloated pages
- archiving stale pages
- creating useful stubs
- retopicing pages
- adding or repairing links
- adding hub pages
- doing nothing when the source is not notable

Bad outcomes include:

- summarizing a source into a page just because it was provided
- appending facts to the nearest page without restructuring it
- creating thin pages to prove that information was "captured"
- preserving stale or duplicated pages because the current source did not force
  a local edit
- making the graph technically complete but hard to navigate

## Mathematical Formulation

Let:

```text
D = {s1, s2, ..., sn}
```

where each `s` is a source.

Let:

```text
W = (P, L, T, M)
```

where:

- `P` is the set of wiki pages
- `L` is the link graph
- `T` is the topic / taxonomy structure
- `M` is metadata such as provenance, freshness, archive state, and source refs

The quality objective is not a single scalar in the product, but it is useful to
think of it as:

```text
Q(W, D) =
  factuality(W, D)
+ organization(W)
+ navigability(W)
+ compression(W, D)
+ usefulness_for_future_agent(W)
- redundancy(W)
- contradiction(W)
- stale_claims(W, D)
- orphaned_pages(W)
- bloated_pages(W)
```

The system is trying to choose an update strategy `A` that improves `Q` under
budget `B`:

```text
W' = A(W, D, B, goal)
```

For a single source, the naive recurrence is:

```text
W_i+1 = G(W_i, s_i)
```

where `G` is the wiki gardener.

That recurrence is useful, but it has a hidden assumption: it assumes the corpus
is small enough, ordered enough, or locally meaningful enough that processing
one source at a time is a good strategy. That is true for many session streams
or chronological logs. It is not necessarily true for whole codebases or large
unordered corpora.

For `codealmanac`, the more accurate function is:

```text
W' = G(W, S, D, goal)
```

where:

- `W` is the current wiki
- `S` is the selected source or event
- `D` is the broader codebase / domain corpus
- `goal` is the user or product intent

Ingestion is therefore not isolated summarization. It is contextual
compilation.

## What We Initially Considered

An early framing was to build source adapters that extract structured facts,
events, decisions, and metadata into a normalized evidence bundle. That looked
roughly like:

```text
source -> adapter -> facts/events/decisions -> wiki writer
```

This is tempting because structured information is easier to pass between
programs. It also fits traditional pipeline thinking.

The problem is that this can become the wrong abstraction for agents. Agents do
not naturally need a rigid fact/event IR to perform the judgment-heavy part of
wiki maintenance. If the system over-invests in structured extraction, it risks
rebuilding the kind of pipeline the project explicitly wants to avoid:

- proposal files
- apply/review state machines
- hard-coded judgment in TypeScript
- source-specific logic that decides what matters before the writer sees the
  broader context

The corrected framing is:

```text
source resolution and reading strategy can be structured
wiki judgment should remain agentic
```

The source layer may inventory files, locate transcripts, search, cluster, or
prepare a bounded reading context. But the core operation should still be:

```text
Here is the source context.
Here is the current wiki.
Here is the broader codebase context.
Improve the wiki as a whole artifact.
```

## Prior Art: Karpathy LLM Wiki

`docs/research/karpathy-llm-wiki.md` describes a persistent wiki maintained by
an LLM. The central contrast is with RAG.

RAG retrieves raw chunks at query time. The system rediscovers and resynthesizes
knowledge every time a question is asked.

The LLM wiki pattern compiles knowledge into a durable markdown graph. The
cross-references, contradictions, summaries, and synthesis accumulate.

Its layers are:

1. Raw sources: immutable source documents
2. Wiki: mutable LLM-owned markdown pages
3. Schema / instructions: the operating manual for how the LLM maintains the
   wiki

Its main operations are:

- ingest a source and update many affected pages
- query the wiki, with useful answers optionally filed back into the wiki
- lint the wiki for contradictions, stale claims, orphans, and missing links

This gives `codealmanac` the high-level pattern: the wiki is the compiled
artifact, not a cache of retrieved chunks.

## Prior Art: Farzapedia

`docs/research/farzapedia.md` is more operational. It defines a personal wiki
compiled from raw entries.

Its main loop is `absorb`:

```text
Process entries one at a time.
Before each entry, read the index.
For each affected article, re-read the article before editing it.
Update or create articles based on what the entry means.
Integrate into the article, do not append mechanically.
```

The important principle is:

```text
The question is not "where do I put this fact?"
The question is "what does this mean, and how does it connect to what I already know?"
```

Farzapedia also names two failure modes:

- Anti-cramming: do not stuff everything into a few giant pages.
- Anti-thinning: do not create many weak pages that lack substance.

It adds periodic quality gates:

- every 15 entries, rebuild index and backlinks
- audit recently updated articles
- split bloated pages
- create missing articles
- reorganize directories when the structure has drifted

For `codealmanac`, this maps well onto the need for a gardening loop. The
domain changes from "map of a mind" to "institutional memory of a codebase."

## Algorithm Families

### 1. Linear Absorption

Linear absorption is the simplest recurrence:

```text
function linear_absorption(W, sources):
  for source in ordered(sources):
    W = gardener(W, source, broader_context = null)
  return W
```

This works when sources are naturally ordered and each entry is meaningful on
its own:

- journals
- meeting logs
- AI session history
- support threads
- chronological project notes

It is weaker for initial whole-codebase understanding. Processing files one by
one can overfit the wiki to arbitrary early files and force later repair.

Use this for ongoing updates after the wiki has a reasonable scaffold.

### 2. Survey-Scaffold-Absorb

This is the best default for first-time codebase understanding.

```text
function survey_scaffold_absorb(D):
  map = survey(D)
  W = scaffold(map)

  for source in select_high_signal_sources(D, map):
    W = gardener(W, source, broader_context = D)

  W = reorganize(W, sample(D))
  return W
```

A strong coding agent does not understand a repo by reading every file in
alphabetical order. It first inspects the shape:

- package files
- README and docs
- routes and entrypoints
- schemas
- commands
- tests
- config
- dependency graph
- high-churn or high-centrality files

Then it creates a provisional map and deepens the important areas.

For `codealmanac`, this is the right mental model for `init`.

### 3. Hierarchical Compile

This is the large-corpus algorithm.

```text
function hierarchical_compile(D):
  clusters = partition(D)
  cluster_maps = []

  for cluster in clusters:
    cluster_maps.append(survey(cluster))

  global_map = synthesize(cluster_maps)
  W = scaffold(global_map)

  for cluster in prioritize(clusters, global_map):
    W = deepen(W, cluster)

  return garden(W)
```

It is MapReduce-like: create local maps, synthesize a global map, then deepen
selectively.

This is useful for:

- huge monorepos
- many months of sessions
- enterprise document collections
- internet-scale corpora

The risk is lossy intermediate summaries. The mitigation is to treat summaries
as disposable navigation aids, not source of truth. Important wiki claims should
still be checked against raw sources when possible.

### 4. Demand-Driven Expansion

Demand-driven expansion starts with a minimal map and grows around real usage.

```text
function answer_and_remember(W, D, question):
  sources = retrieve(D, question, W)
  answer = synthesize(W, sources, question)

  if durable(answer):
    W = gardener(W, answer, broader_context = sources)

  return answer, W
```

This is useful when full upfront compilation is too expensive. The wiki grows
around tasks and questions that actually occur.

The weakness is coverage bias. The wiki reflects what has been asked, not
necessarily the intrinsic structure of the corpus.

### 5. Periodic Whole-Wiki Gardening

Whole-wiki gardening is not source ingest. It is graph maintenance.

```text
function garden(W):
  issues = audit(W)
  W = repair(W, issues)
  rebuild_index(W)
  return W
```

It looks for:

- duplicate pages
- overlapping scopes
- missing anchors
- missing hubs
- weak stubs
- bloated pages
- stale claims
- broken links
- orphan pages
- topic drift

This pass is essential because no ingest strategy preserves structure forever.

## Search, RAG, And Agentic Reading

RAG is useful, but it should not be the product.

The product is:

```text
the repo-owned, git-native wiki
```

Search and RAG are reading strategies. They help the agent decide what to read
when the source space is too large.

Bad framing:

```text
raw corpus + RAG = product
```

Better framing:

```text
raw corpus + search/RAG/grep/agent exploration = reading tools
agent gardener = compiler
.almanac wiki = product
```

If we were constructing a wiki over web-scale documents, the agent would not
crawl every page. It would use search. The same principle applies locally:

- use `rg` over source code
- use SQLite FTS over wiki pages
- use git diff and git log for code changes
- use session metadata to locate relevant conversations
- optionally use embeddings/vector retrieval when lexical search is not enough

RAG may become necessary for some large or semantically messy corpora, but it is
not necessary as the first architecture. Start with agentic search over
filesystem, git, SQLite FTS, and inventories. Add semantic retrieval when a real
source type proves lexical search insufficient.

## The Code Conversation Case

AI coding sessions are not just transcripts. A session is an event in the
codebase.

For capture, the relevant context is:

```text
S = transcript
D = repo + changed files + git diff + tests + existing docs
W = .almanac wiki
goal = preserve what future coding agents should know from this session
```

The transcript alone is not the truth. Durable knowledge emerges from the
relationship between:

- what the user asked
- what the agent reasoned
- what files changed
- what tests or builds showed
- what the code now says
- what the wiki already believed

A good capture algorithm should therefore look like:

```text
function capture_session(W, session):
  transcript = read_session(session)
  changed_files = resolve_changed_files(session)
  diff = read_relevant_diff(session)
  related_pages = search_wiki(W, transcript, changed_files)
  related_code = inspect_repo(changed_files)

  context = {
    transcript,
    changed_files,
    diff,
    related_pages,
    related_code
  }

  return gardener(W, context, goal = "future coding sessions")
```

This is stronger than "summarize the transcript." It grounds wiki changes in
the codebase.

## Manual Ingest Case

Manual ingest is user-directed context. The user points at a file or folder and
asks the system to learn from it.

The algorithm should not create a page per file or summarize the folder. It
should treat the target as evidence.

```text
function manual_ingest(W, target, goal):
  inventory = inventory_target(target)
  target_plan = agent_survey(inventory, W)
  selected_reads = agent_select_reads(target, target_plan)
  related_pages = search_wiki(W, target_plan)
  related_code = inspect_repo_if_needed(target_plan)

  context = {
    inventory,
    selected_reads,
    related_pages,
    related_code,
    user_goal = goal
  }

  return gardener(W, context, goal)
```

The user target should matter strongly, but the write still happens in the
context of the current wiki and codebase.

## Initial Codebase Case

For first-time setup, source-by-source recurrence is the wrong default. A repo
needs orientation before absorption.

```text
function init_codebase_wiki(repo):
  map = survey_repo(repo)
  W = create_scaffold(map)
  sources = choose_high_signal_areas(repo, map)

  for source in sources:
    W = gardener(W, source, broader_context = repo)

  W = final_garden(W)
  return W
```

The initial wiki should not pretend to know hidden rationale. It should create
anchors and stubs where future capture can attach knowledge.

## Public Interface Versus Backend Architecture

CLI commands are product interface. They should not dictate backend structure.

Public commands may be:

```text
almanac init
almanac capture
almanac ingest <file-or-folder>
almanac garden
```

Or later:

```text
almanac ingest --sessions
almanac ingest --repo
almanac ingest <path>
```

That naming decision is separate from the algorithm.

Internally, commands should build requests for the same core engine:

```text
CLI command
  -> request builder
  -> source resolver
  -> reading strategy
  -> wiki gardener
  -> verification / index / log summary
```

Potential internal request shape:

```typescript
type WikiUpdateRequest = {
  intent:
    | "init"
    | "session-capture"
    | "manual-context"
    | "whole-wiki-garden"
    | "repo-refresh";
  target?: string;
  sourceHints?: string[];
  budget: "fast" | "normal" | "deep";
  userGoal?: string;
};
```

The backend should answer:

- what source space am I looking at?
- what surrounding corpus matters?
- what current wiki context matters?
- what codebase context matters?
- what reading/search strategy fits?
- what wiki changes improve the whole graph?

## Recommended Architecture Shape

The backend should be organized around gardening, not around command names.

Possible shape:

```text
src/gardener/
  request.ts
  engine.ts
  prompts.ts
  reviewer.ts
  context/
    wiki.ts
    repo.ts
    sessions.ts
    targets.ts
  strategies/
    repo-survey.ts
    session.ts
    manual-context.ts
    whole-wiki.ts
```

CLI commands stay thin:

```text
init    -> build repo survey request -> run gardener
capture -> build session request -> run gardener
ingest  -> build manual context request -> run gardener
garden  -> build whole-wiki request -> run gardener
```

This lets public naming evolve without rewriting the core.

## Recommended Near-Term Algorithm

Do not try to implement every algorithm now. The near-term algorithm should be:

```text
Search-Guided Wiki Gardening
```

For each command:

1. Build a bounded context package.
2. Let the agent search the wiki and repo as needed.
3. Ask the agent to improve the wiki, not summarize the source.
4. Allow create, update, merge, split, archive, retopic, relink, stub, and no-op.
5. Reindex and report the page delta.

Near-term command behavior:

```text
init:
  survey repo broadly
  create anchors and stubs
  avoid invented rationale

capture:
  read session transcript
  include changed files / diff when available
  search existing wiki for touched concepts
  update the wiki only for durable codebase knowledge

ingest:
  inventory the target
  agent reads selectively
  search existing wiki and repo for context
  update the wiki only when the target helps future coding sessions

garden:
  audit the whole wiki
  repair organization without requiring a new source
```

This is compatible with the manual ingest plan, but it should be framed as a
manual context pathway into the same gardener, not as a separate pipeline.

## Open Design Questions

1. Should `capture` remain a public command, or eventually become
   `ingest --sessions`?

   This is a UX decision. Internally both should use the same gardener.

2. Should batch ingest ever create intermediate structured findings?

   Maybe, but only as disposable working notes for very large batches. It should
   not become the core product model.

3. When does semantic retrieval become necessary?

   Only after filesystem search, git search, session metadata, and wiki FTS fail
   on real corpora.

4. How does the system know it made the wiki better?

   Near-term: reviewer prompt and health checks.
   Later: explicit gardening criteria around anchors, hubs, redirects, stubs,
   bloat, duplication, and stale pages.

5. How aggressive should the gardener be?

   Manual ingest can be conservative. Whole-wiki `garden` can be more aggressive
   about merge/split/archive, because its purpose is graph health.

## Current Recommendation

Build the shared gardener engine first enough to support manual ingest cleanly,
but do not overgeneralize into a heavy framework.

The first implementation should prove this loop:

```text
request -> bounded context -> agentic reading/search -> wiki edits -> reviewer -> reindex -> summary
```

Then `capture`, `init`, and future `garden` can converge on the same engine.

The core product belief is:

```text
The wiki is a compiled, living artifact.
Sources are evidence.
Search is a reading strategy.
The gardener optimizes the whole graph.
```
