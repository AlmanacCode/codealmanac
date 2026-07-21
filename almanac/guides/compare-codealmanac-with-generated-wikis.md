---
title: Compare CodeAlmanac With Generated Wikis
topics: [guides, product]
sources:
  - id: product-surface
    type: wiki
    path: product
    note: Product hub that routes launch, demo, release, and local-only boundary pages.
  - id: launch-positioning
    type: wiki
    path: product/positioning
    note: Product positioning and evaluation framing for CodeAlmanac.
  - id: evaluation-benchmarks
    type: wiki
    path: product/evaluation-benchmarks
    note: Product page for benchmark and evaluation strategy.
  - id: comparison-transcript
    type: conversation
    session_id: rollout-2026-07-12T16-26-10-019f58a7-0c22-7fe2-89af-1b1c91ccb5fd
    note: Product conversation about comparing CodeAlmanac with OpenWiki-style generated repository documentation.
  - id: benchmark-harness-transcript
    type: conversation
    session_id: rollout-2026-07-13T02-31-09-019f5ad0-eb82-7fa0-9feb-221d5c064532
    note: Benchmark harness review and memory-benchmark mapping for CodeAlmanac evaluation.
---

# Compare CodeAlmanac With Generated Wikis

Use this guide when comparing CodeAlmanac with an OpenWiki-style generated
repository wiki. It belongs to the [Product surface](../product) route for
launch and demo work, and it turns the [Product positioning](../product/positioning)
frame into a benchmark procedure [@product-surface] [@launch-positioning]. The
comparison should measure whether a fresh coding agent can use the wiki to make
better decisions, not whether one product has more pages or a better home
screen. Search proves retrieval, but a task proves the agent actually applied
the knowledge [@launch-positioning].

## Start With A Repo-Only Benchmark

Generate both wikis from the same fresh repository checkout. Use the same model,
a similar run budget, and no pre-existing documentation beyond what the
repository already contains [@comparison-transcript].

Ask a fresh agent hidden questions using only each generated wiki. Good
questions target architecture and maintenance work:

- Where does authentication enter the system?
- What owns database transactions?
- How does a background job fail and recover?
- Which files must change to add a provider?
- What invariants must a contributor preserve?

Score each answer on correctness, completeness, useful source evidence, and
actionability. Penalize hallucinated facts separately so a long confident answer
does not beat a shorter grounded one [@comparison-transcript].

## Add A Living-Memory Benchmark

The repo-only benchmark is fair, but it does not test CodeAlmanac's core
advantage. A second pass should make a small code change, include a realistic
coding conversation with an important decision or rejected approach, then run
each product's normal update workflow [@comparison-transcript].

Ask follow-up questions about both the code change and the conversation-derived
decision. This separates two claims: whether the product maintains code
documentation, and whether it preserves durable context that existed outside the
code [@comparison-transcript].

Use [Evaluation benchmarks](../product/evaluation-benchmarks) to choose the benchmark
level. LoCoMo-style and LongMemEval-style questions can test retrieval, but the
closer product fit is LongMemEval-V2-style operational knowledge or
MemoryArena-style multi-session action where the agent must use remembered
experience during later work [@evaluation-benchmarks] [@benchmark-harness-transcript].
When LoCoMo-style questions are used, treat stock CodeAlmanac search as a
separate baseline: it is strict page-level lexical FTS, so a zero-result answer
can mean the current retriever missed differently worded knowledge, not that the
wiki failed to preserve the knowledge [@benchmark-harness-transcript].

## Include A Practical Task

The strongest comparison is an implementation task. Ask an agent to make the
same small change with each wiki, then judge whether it found the right
extension point, obeyed the repository's architectural rules, avoided known
failed approaches, minimized extra source exploration, and produced a correct
implementation [@comparison-transcript].

For launch screenshots, compare equivalent detailed subsystem or workflow pages.
Do not compare home screens; the product claim is about whether a page changes
agent behavior during work [@comparison-transcript].

## Verify The Benchmark Harness

Treat the benchmark harness as part of the claim being tested. A green test
suite is not enough when the tests encode the wrong baseline behavior, so review
the baseline search grammar, the exact text indexed versus shown to the
answering agent, and the behavior when the first relevant result exceeds the
context budget [@benchmark-harness-transcript].

Use distinct rows for stock CodeAlmanac search and any experimental paragraph
retriever. A paragraph-level lexical retriever can test whether the wiki
representation is useful when retrieval returns the most relevant sections
instead of whole pages; embeddings or agentic search should be later rows
because they change a different part of the system [@benchmark-harness-transcript].

Artifact storage also affects fairness. Benchmark artifacts should be partitioned
by run, variant, and case; cleanup should refuse foreign directories; and large
shared inputs such as session blobs should be stored once instead of copied into
every case snapshot [@benchmark-harness-transcript]. Otherwise one variant can
delete another variant's evidence or create quadratic storage growth that hides
the real comparison result.
