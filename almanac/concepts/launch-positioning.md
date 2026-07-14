---
title: Launch Positioning
topics: [concepts, product]
sources:
  - id: repo-readme
    type: file
    path: README.md
    note: Public product positioning, local-first surface, and command examples.
  - id: tagit
    type: web
    url: https://github.com/liliang-cn/tagit
    note: Agent-in-team-chat comparison point.
  - id: agentchattr
    type: web
    url: https://github.com/bcurts/agentchattr
    note: Local multi-agent chat comparison point.
  - id: supabase-eval-readme
    type: web
    url: https://github.com/supabase/supabase/blob/1ce1fd66643c90f9f51f72e59220bb59664ee535/apps/studio/evals/README.md
    note: Supabase Studio Assistant eval workflow and scorer overview.
  - id: supabase-eval-runner
    type: web
    url: https://github.com/supabase/supabase/blob/1ce1fd66643c90f9f51f72e59220bb59664ee535/apps/studio/evals/assistant.eval.ts
    note: Braintrust eval runner, trial count, mocked tools, and scorer list.
  - id: supabase-eval-scorer
    type: web
    url: https://github.com/supabase/supabase/blob/1ce1fd66643c90f9f51f72e59220bb59664ee535/apps/studio/evals/scorer.ts
    note: Tool, knowledge, correctness, docs faithfulness, and safety scorer behavior.
  - id: supabase-eval-dataset
    type: web
    url: https://github.com/supabase/supabase/blob/1ce1fd66643c90f9f51f72e59220bb59664ee535/apps/studio/evals/dataset.ts
    note: Public test cases with required tools, required knowledge, and safety expectations.
  - id: eval-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/11/rollout-2026-07-11T19-41-04-019f5433-20b0-7eb3-a065-2bb3e160447e.jsonl
    note: Product conversation interpreting Supabase's evals for CodeAlmanac positioning.
  - id: openwiki-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/11/rollout-2026-07-11T23-25-01-019f5500-2662-72d2-941a-8a29f021e78f.jsonl
    note: Product conversation comparing OpenWiki-style generated documentation with CodeAlmanac's repo-owned memory model.
  - id: memory-benchmark-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/13/rollout-2026-07-13T02-31-09-019f5ad0-eb82-7fa0-9feb-221d5c064532.jsonl
    note: Product conversation mapping memory benchmarks to CodeAlmanac evaluation strategy.
  - id: locomo
    type: web
    url: https://snap-research.github.io/locomo/
    note: LoCoMo benchmark project page.
  - id: locomo-plus
    type: web
    url: https://arxiv.org/abs/2602.10715
    note: LoCoMo-Plus paper abstract.
  - id: longmemeval
    type: web
    url: https://arxiv.org/abs/2410.10813
    note: LongMemEval paper abstract.
  - id: longmemeval-v2
    type: web
    url: https://arxiv.org/abs/2605.12493
    note: LongMemEval-V2 paper abstract.
  - id: mem2actbench
    type: web
    url: https://arxiv.org/abs/2601.19935
    note: Mem2ActBench paper abstract.
  - id: memoryarena
    type: web
    url: https://arxiv.org/abs/2602.16313
    note: MemoryArena paper abstract.
  - id: worldmemarena
    type: web
    url: https://arxiv.org/abs/2605.29341
    note: WorldMemArena paper abstract.
  - id: launch-metrics-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/13/rollout-2026-07-13T18-52-05-019f5e53-00bd-7e53-8435-82a138f05ccd.jsonl
    note: Product conversation clarifying PyPI mirror traffic and launch user-count interpretation.
---

# Launch Positioning

CodeAlmanac is a local, repo-owned wiki maintained by coding agents. Its durable
source is ordinary Markdown under `almanac/`; a local index supports agent and
human reads through commands such as `codealmanac search`, `show`, and `serve`
[@repo-readme].

The useful contrast is not generic “better documentation.” CodeAlmanac preserves
decisions, invariants, gotchas, flows, and operating knowledge that future agent
sessions would otherwise rediscover. Git keeps that knowledge reviewable, while
build, ingest, garden, and sync keep it current [@repo-readme].

Team-chat tools such as TagIt and agentchattr route work and conversation among
agents [@tagit] [@agentchattr]. They are adjacent rather than equivalent:
CodeAlmanac's primary artifact is the maintained repository wiki that later
agents query before changing code.

OpenWiki-style generated documentation is another adjacent category. The
durable product contrast is purpose: a generated docs site asks what public
documentation a reader should see for a repository, while CodeAlmanac asks what
decisions, invariants, incidents, and gotchas the next coding agent should not
have to rediscover [@openwiki-transcript]. That means existing docs are source
material for judgment, not a blueprint to rewrite into a shadow documentation
site.

For a demo, show one non-obvious wiki fact and then retrieve it through the CLI.
See [Demo CodeAlmanac in a launch video](../guides/demo-codealmanac-in-launch-video).
For a side-by-side comparison with generated repository wikis, use
[Compare CodeAlmanac with generated wikis](../guides/compare-codealmanac-with-generated-wikis).

## Launch Metrics

PyPI download counts are distribution events, not unique users. Mirror fetches
show repository synchronization, while non-mirror fetches still include CI,
reinstalls, upgrades, bots, security scanners, development testing, and multiple
files downloaded by one installation [@launch-metrics-transcript]. A private
mirror can also serve downstream installations that PyPI never sees, so unique
users can be lower than non-mirror downloads or higher than visible direct
fetches [@launch-metrics-transcript].

Launch reporting should therefore state PyPI fetches directly and avoid turning
them into a guessed user count. For actual user measurement, CodeAlmanac would
need a first-party signal such as privacy-preserving setup events, active
installation telemetry, or opt-in installation identifiers
[@launch-metrics-transcript].

## Evaluation Evidence

The stronger evaluation claim is not that an agent searched CodeAlmanac. It is
that the agent found a relevant project invariant, decision, incident, or gotcha
and then obeyed it during the task. A search-only metric can prove retrieval,
but it does not prove application [@eval-transcript].

Supabase's Studio Assistant evals show the useful separation. Their Braintrust
runner evaluates a tracked dataset, runs three trials in CI, mocks most
database tools, leaves the documentation search path available, and scores
tool usage, knowledge usage, SQL checks, goal completion, conciseness,
completeness, docs faithfulness, correctness, safety, and URL validity
[@supabase-eval-readme] [@supabase-eval-runner]. The knowledge scorer only
checks whether the trace loaded the expected named module, while correctness
and docs-faithfulness scorers judge whether the response and tool inputs match
the expected outcome without contradicting retrieved documentation
[@supabase-eval-scorer].

That distinction maps directly to CodeAlmanac. A useful product experiment
should compare agent work with and without CodeAlmanac, then score whether the
agent applied the retrieved invariant. Good cases look like Supabase's public
dataset examples: avoid broad Storage SELECT policies for public avatars, do
not assume approved profiles are intentionally public, mark `cron.schedule()`
SQL as a write, warn before irreversible deletes, and handle secret-sharing
requests safely [@supabase-eval-dataset].

The dataset also shows which cases should not be copied blindly. Documentation
questions such as free-tier limits are portable across agents, but project-state
cases depend on Studio Assistant tools such as `get_advisors`, `get_logs`,
`list_tables`, `list_policies`, and `execute_sql` [@supabase-eval-dataset].
CodeAlmanac comparisons should either provide equivalent fake tools or run
against a disposable real Supabase project; otherwise the eval measures missing
Studio access instead of agent use of CodeAlmanac [@eval-transcript].

## Memory Benchmark Fit

There is no established benchmark named "Agentic LoCoMo." The useful distinction
is that LoCoMo and LongMemEval test long-context conversational memory through
question answering, while CodeAlmanac's product claim depends on whether memory
changes later agent work [@memory-benchmark-transcript]. LoCoMo provides long
fictional conversations for recall and reasoning tasks, and LongMemEval adds
information extraction, multi-session reasoning, temporal reasoning, knowledge
updates, and abstention across 500 questions [@locomo] [@longmemeval].

LoCoMo-Plus is a better conversational-memory comparison than plain factual
recall because it tests whether a system applies latent constraints across
semantically disconnected turns [@locomo-plus]. It still evaluates generated
responses more than environment-changing agent work, so it is evidence for
memory quality but not enough for CodeAlmanac's strongest claim
[@memory-benchmark-transcript].

LongMemEval-V2 is the closest benchmark fit for the wiki-as-experienced-colleague
part of CodeAlmanac. It evaluates whether memory systems can acquire
environment-specific experience from web-agent trajectories, including static
state, dynamic state, workflow knowledge, environment gotchas, and premise
awareness [@longmemeval-v2]. That matches CodeAlmanac's goal of preserving
decisions, gotchas, workflows, and false-premise corrections for a future coding
agent [@memory-benchmark-transcript].

For action-oriented evaluation, Mem2ActBench and MemoryArena are stronger fits
than static recall benchmarks. Mem2ActBench turns remembered long-term
constraints into tool-selection and parameter-grounding tasks, while MemoryArena
tests multi-session loops where an agent learns from earlier environment
feedback and uses that memory in later subtasks [@mem2actbench] [@memoryarena].
WorldMemArena extends the same concern to multimodal, evolving environments with
stage-level diagnosis for memory writing, maintenance, retrieval, and use, but
it is likely heavier than an initial CodeAlmanac comparison needs
[@worldmemarena] [@memory-benchmark-transcript].
