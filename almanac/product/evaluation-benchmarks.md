---
title: Evaluation Benchmarks
topics: [product]
sources:
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
    session_id: rollout-2026-07-11T19-41-04-019f5433-20b0-7eb3-a065-2bb3e160447e
    note: Product conversation interpreting Supabase's evals for CodeAlmanac positioning.
  - id: memory-benchmark-transcript
    type: conversation
    session_id: rollout-2026-07-13T02-31-09-019f5ad0-eb82-7fa0-9feb-221d5c064532
    note: Product conversation mapping memory and repository-QA benchmarks to CodeAlmanac evaluation strategy and recording the July 2026 consolidated LoCoMo comparison.
  - id: swe-qa
    type: web
    url: https://aclanthology.org/2026.findings-acl.402.pdf
    note: Repository-level code question answering benchmark used as the closest fit for CodeAlmanac evaluation.
  - id: fastcontext
    type: web
    url: https://arxiv.org/abs/2606.14066
    note: Repository exploration subagent paper that reports token-consumption reductions on SWE-QA.
  - id: code-rag-bench
    type: web
    url: https://github.com/code-rag-bench/code-rag-bench
    note: Code retrieval and generation benchmark suite considered as a secondary evaluation reference.
  - id: locobench-agent
    type: web
    url: https://github.com/SalesforceAIResearch/LoCoBench-Agent
    note: Long-context coding-agent benchmark considered as a secondary evaluation reference.
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
  - id: positioning
    type: wiki
    path: product/positioning
    note: Product positioning page that states the core agent-memory claim.
---

# Evaluation Benchmarks

Evaluation benchmarks explain how to test the product claim from
[Product positioning](positioning): CodeAlmanac is useful when an agent finds a
project invariant, decision, incident, or gotcha and then obeys it during later
work [@positioning]. A search-only metric can prove retrieval, but it does not
prove application [@eval-transcript].

## Applied Knowledge

Supabase's Studio Assistant evals show the useful separation. Their Braintrust
runner evaluates a tracked dataset, runs three trials in CI, mocks most
database tools, leaves the documentation search path available, and scores
tool usage, knowledge usage, SQL checks, goal completion, conciseness,
completeness, docs faithfulness, correctness, safety, and URL validity
[@supabase-eval-readme] [@supabase-eval-runner]. The knowledge scorer checks
whether the trace loaded the expected named module, while correctness and
docs-faithfulness scorers judge whether the response and tool inputs match the
expected outcome without contradicting retrieved documentation
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

For repository-level question answering, SWE-QA is the closest benchmark fit.
It contains 720 repository-level questions across Python repositories and covers
architecture, intent, cross-file reasoning, and multi-hop dependency analysis
[@swe-qa] [@memory-benchmark-transcript]. FastContext is the useful companion
methodology because it runs SWE-QA while accounting for coding-agent token
consumption and reports improved resolution with lower token use from a focused
repository-exploration subagent [@fastcontext] [@memory-benchmark-transcript].

The missing standard metric is a direct "minimum tokens required to answer this
codebase question correctly" score. CodeAlmanac can add that layer by running
SWE-QA-style questions at fixed context budgets, reporting accuracy at each
budget, the lowest successful budget per question, median tokens-to-correct,
total processed tokens, and cost per correct answer [@memory-benchmark-transcript].
That would test CodeAlmanac's core product claim more directly than a
conversation-memory benchmark: whether a maintained repo wiki lets an agent
answer repository questions and understand project constraints with less
exploration.

RepoQA, CodeRAG-Bench, and LoCoBench-Agent remain secondary references. They
are useful for retrieval, code generation, and long-context coding-agent
evaluation, but they are not as directly aligned with natural repository-level
architectural question answering plus token efficiency [@code-rag-bench]
[@locobench-agent] [@memory-benchmark-transcript].

## July 2026 LoCoMo Snapshot

The latest consolidated LoCoMo comparison is useful as a retrieval-quality
snapshot, not as proof that CodeAlmanac improves coding-agent work. It compared
CodeAlmanac, BM25, Supermemory, and Mem0 at 1,000, 2,000, and 8,000 token
context budgets across official token-F1 and semantic-judge accuracy
[@memory-benchmark-transcript].

At the 8,000-token budget, CodeAlmanac reached 59.72% semantic-judge accuracy,
nearly tied with BM25 at 60.07% and ahead of Supermemory at 52.06%
[@memory-benchmark-transcript]. Its official token-F1 stayed lower than BM25:
27.95% for CodeAlmanac versus 35.06% for BM25 at the same 8,000-token budget
[@memory-benchmark-transcript].

The small-budget result exposed the main product issue for evaluation work.
CodeAlmanac scored 25.08% semantic accuracy at 1,000 tokens and 36.20% at 2,000
tokens, while BM25 scored 44.31% and 51.86% at those same budgets
[@memory-benchmark-transcript]. The durable interpretation is that the wiki had
useful information, but the full-page retrieval path wasted tight context
budgets [@memory-benchmark-transcript].

Mem0 had the strongest semantic scores in the snapshot, but its run completed
only 1,157 of 1,986 questions. Treat that result as partial coverage rather
than a fully comparable leaderboard entry [@memory-benchmark-transcript].
