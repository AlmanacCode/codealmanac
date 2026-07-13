---
title: Compare CodeAlmanac With Generated Wikis
topics: [guides, product]
sources:
  - id: launch-positioning
    type: wiki
    path: concepts/launch-positioning
    note: Product positioning and evaluation framing for CodeAlmanac.
  - id: comparison-transcript
    type: conversation
    path: /Users/rohan/.codex/sessions/2026/07/12/rollout-2026-07-12T16-26-10-019f58a7-0c22-7fe2-89af-1b1c91ccb5fd.jsonl
    note: Product conversation about comparing CodeAlmanac with OpenWiki-style generated repository documentation.
---

# Compare CodeAlmanac With Generated Wikis

Use this guide when comparing CodeAlmanac with an OpenWiki-style generated
repository wiki. The comparison should measure whether a fresh coding agent can
use the wiki to make better decisions, not whether one product has more pages or
a better home screen. That follows the launch positioning rule: search proves
retrieval, but a task proves the agent actually applied the knowledge
[@launch-positioning].

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

## Include A Practical Task

The strongest comparison is an implementation task. Ask an agent to make the
same small change with each wiki, then judge whether it found the right
extension point, obeyed the repository's architectural rules, avoided known
failed approaches, minimized extra source exploration, and produced a correct
implementation [@comparison-transcript].

For launch screenshots, compare equivalent detailed subsystem or workflow pages.
Do not compare home screens; the product claim is about whether a page changes
agent behavior during work [@comparison-transcript].
