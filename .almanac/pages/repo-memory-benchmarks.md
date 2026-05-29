---
title: Repo Memory Benchmarks
summary: Codealmanac's strongest product evidence is that repo memory improves coding outcomes, not just that a benchmark can retrieve prior chat memories.
topics: [product, agents]
files:
  - src/commands/search.ts
  - src/commands/show.ts
  - src/commands/operations.ts
  - src/commands/capture-sweep.ts
  - src/indexer/index.ts
  - prompts/base/notability.md
  - prompts/operations/absorb.md
sources:
  - /Users/kushagrachitkara/.codex/sessions/2026/05/19/rollout-2026-05-19T22-18-59-019e43d2-a98d-7940-b552-03658988fcf4.jsonl
verified: 2026-05-20
---

# Repo Memory Benchmarks

Codealmanac should not pitch itself with a single "we scored X on LongMemEval" claim. The durable product claim is stronger and more specific: project memory should make coding agents make fewer context mistakes, rediscover less prior work, and finish real repo tasks faster.

LongMemEval-style retrieval is still relevant, but only as the narrow retrieval slice of a broader benchmark story. The current product surface already spans retrieval (`[[src/commands/search.ts]]`, `[[src/commands/show.ts]]`), memory capture (`[[prompts/operations/absorb.md]]`, `[[src/commands/operations.ts]]`), and continuity across sessions (`[[src/commands/capture-sweep.ts]]`). Evaluation should therefore measure the full loop rather than only "can the model recall an old conversation."

## What the benchmark has to prove

The strongest evidence is operational, not literary. A benchmark should show that a repo with Almanac memory produces better coding behavior than the same repo with only source code, README files, or raw transcript/context stuffing.

The product question is not "can the system retrieve a remembered fact." The product question is "does the remembered fact change the edit, review, and completion outcome on real work."

## Benchmark families

### Context retrieval

Use issue-like coding tasks plus touched-file hints, then score whether search retrieves the wiki page that contains the relevant invariant, decision, or gotcha. The natural metrics are `Recall@1`, `Recall@3`, `Recall@5`, and `MRR`.

This is the closest equivalent to LongMemEval, but scoped to repo work. A representative task shape is "fix a bug in `[[src/commands/capture-sweep.ts]]`" with a gold answer page such as [[capture-ledger]] or [[capture-flow]].

### Bad edit prevention

Build tasks where an uninformed agent is likely to violate an established repo rule, then compare runs with and without Almanac context. Candidate constraints already exist in pages such as [[sqlite-indexer]], [[capture-flow]], [[provider-lifecycle-boundary]], and [[operation-prompts]].

The key metrics are violation rate, broken tests, review findings, and whether the agent explicitly preserved the known invariant. This is the clearest proof that memory is preventing damage rather than merely adding narration.

### Rediscovery time

Give agents tasks that require historical or non-obvious project knowledge and measure time to first correct hypothesis, files opened before the right area is found, total tokens used, false starts, and whether the agent repeats a previously rejected approach.

This measures whether Almanac reduces the cost of reorientation. It matches the product claim that future agents should start from reusable understanding instead of reconstructing it from scratch.

### Task completion lift

Use real issues from this repo or from external open-source repos and compare several baselines:

- code only
- code plus README/docs
- code plus manual Almanac search
- code plus automatic Almanac context surfacing

The core metrics are task success rate, time to working patch, test pass rate, human acceptance rate, and review-comment count. This is the direct answer to "does this make agents better at software work."

### Review burden reduction

Evaluate PRs or patches produced with and without Almanac against human review or a review agent. The interesting measures are defects per patch, architecture-context comments, revision rounds, and reviewer time.

This turns wiki value into engineering ROI. It also tests whether preserved project context changes downstream review quality instead of only upstream generation.

### Memory capture quality

After a coding session, compare transcript plus final diff against what Absorb preserved in the wiki. Score whether it captured the durable decision, invariant, or lesson; whether it avoided junk; and whether the resulting page would let a future agent act correctly.

This benchmark is about capture precision and recall, not just search quality. It matters because the product promise includes self-maintaining project memory, not a fixed documentation set.

### Staleness and contradiction detection

Intentionally change code so an existing page becomes wrong, then measure whether Almanac surfaces the contradiction or marks the page as stale. False positives matter here because an over-eager stale detector makes the memory graph noisy and untrustworthy.

This benchmark family tests whether the wiki can stay current as the repo changes, which is one of the main objections to any memory system.

### Cross-session continuity

Use a multi-session setup where one agent discovers a gotcha, Almanac captures it, and a later agent receives a related task. Measure repeated-mistake rate, time saved in the later session, and whether the later agent actually uses the captured page.

This is the clearest demonstration of compound learning across sessions rather than one-session convenience.

### Token efficiency

Compare raw transcript stuffing, generic memory retrieval, Almanac page retrieval, and concise just-in-time Almanac context. Measure task success alongside tokens supplied, relevant facts per token budget, and irrelevant-context rate.

This matters because the product thesis is not "more context." It is "higher-value context with less noise."

### Repo onboarding

Give an agent a new repo and a medium-complexity task, then compare onboarding with no wiki, a generated summary, hand-written docs, and an Almanac graph. Measure time to the correct mental model, wrong architectural assumptions, exploratory file reads, and patch quality.

This is the broadest framing of the category: a new coding agent joining an existing codebase.

## Recommended benchmark stack

The transcript's proposed benchmark set is a compact four-part stack:

- `CodeMemEval-R`: retrieval over repo tasks, scored with `R@1`, `R@3`, `R@5`, and `MRR`
- `CodeMemEval-Act`: task execution with success rate plus bad-edit prevention
- `CodeMemEval-Capture`: post-session capture quality for durable lessons
- ROI study: real tasks showing review-burden reduction, fewer regressions, lower token use, and faster completion

That stack keeps retrieval in scope without letting it dominate the story. The evidence hierarchy is outcome first, retrieval second.

## Product claim this supports

The durable investor and product line is that Codealmanac is not just documentation and not just chat-memory retrieval. It is infrastructure for making coding agents compound: the system preserves project-specific understanding, surfaces it at the moment of work, and changes real coding outcomes across sessions.

Related pages: [[capture-flow]], [[capture-ledger]], [[sqlite-indexer]], [[provider-lifecycle-boundary]], [[operation-prompts]]
