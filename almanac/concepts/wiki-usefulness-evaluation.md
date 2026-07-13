---
title: Wiki Usefulness Evaluation
topics: [concepts, wiki, product]
sources:
  - id: eval-discussion
    type: conversation
    path: /Users/divitsheth/.codex/sessions/2026/07/12/rollout-2026-07-12T17-29-11-019f58e0-bc84-7da3-a822-8e610a1935d8.jsonl
    note: Product discussion that framed useful wiki evaluation around agent task outcomes.
  - id: local-repo-wiki
    type: wiki
    path: concepts/local-repo-wiki
    note: Concept page for the repo-owned Markdown wiki model.
---

# Wiki Usefulness Evaluation

Wiki usefulness evaluation asks whether the [local repo wiki](local-repo-wiki)
helps an agent complete real codebase work better. The primary score is not
page tidiness. It is whether an agent with the wiki succeeds more often, makes
fewer architecture mistakes, spends less time or token budget, and needs less
review rework than an agent using the codebase alone [@eval-discussion]
[@local-repo-wiki].

The concept matters because CodeAlmanac can measure many tidy proxies without
proving product value. A wiki can have healthy links, citations, and topics and
still fail to help a future agent make the right change. The useful evaluation
therefore starts from real work, then uses retrieval and page-quality checks as
diagnostics [@eval-discussion].

## Primary Signal

The strongest evaluation compares realistic tasks under two conditions: codebase
only, and codebase plus Almanac. The task set should include implementation,
debugging, architecture choice, and repository-knowledge questions. Useful
measurements include success rate, correctness, files opened before the agent
understands the task, tokens or elapsed time, review findings, and repeated
violations of documented invariants [@eval-discussion].

This turns the evaluation into a product question: did the wiki improve the
agent's work? It also discourages optimizing the wiki only for clean formatting
or dense coverage [@eval-discussion].

## Supporting Diagnostics

Question-answer tests check whether the wiki preserves repository knowledge
that is hard to infer from code alone. Good prompts ask where provider-specific
logic belongs, which operations may write wiki prose, why path queries use
escaped `GLOB`, or how an ingest run moves through the system [@eval-discussion].

Decision-support tests check whether the wiki teaches engineering judgment.
The evaluator should look for correct boundary choices, noticed invariants,
rejection of tempting one-off fixes, and explanations grounded in the right
pages and source files [@eval-discussion].

Retrieval metrics diagnose whether search surfaces the right pages. Useful
measures include recall, precision, ranking, context efficiency, and robustness
when the same task is phrased different ways [@eval-discussion].

Page-quality metrics remain valuable, but they are secondary. Accuracy against
code, staleness, actionability, specificity, evidence quality, duplication,
contradictions, link health, and coverage of important flows explain why the
wiki helped or failed to help during task evaluation [@eval-discussion].
