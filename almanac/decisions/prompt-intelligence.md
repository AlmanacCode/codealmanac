---
title: Prompt Intelligence
summary: Judgment belongs in prompts and agents, not orchestration pipelines.
topics: [decisions, agents, operations]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo-specific no-pipeline rule.
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Product decision that auto-commit is prompt policy.
  - id: ingest-prompt
    type: file
    path: src/codealmanac/prompts/operations/ingest.md
    note: Ingest operation prompt.
  - id: garden-prompt
    type: file
    path: src/codealmanac/prompts/operations/garden.md
    note: Garden operation prompt.
  - id: commit-policy
    type: file
    path: src/codealmanac/workflows/operations/commit.py
    note: Prompt-facing operation commit policy.
---

# Prompt Intelligence

CodeAlmanac puts judgment in prompts and operation agents, not in propose/review/apply state machines, dry-run rehearsals, orchestration JSON schemas, or smart Git pipelines [@manual]. The writer owns outcomes and may use review feedback without a product-level approve/revise/reject machine [@manual].

Auto-commit is prompt policy, not a CodeAlmanac staging engine [@agreement]. Operation agents may be instructed to use normal Git commands for wiki source files, but CodeAlmanac itself does not classify changes, stage files intelligently, or decide commit boundaries [@commit-policy].

Ingest and garden assemble base prompt sections plus operation-specific prompt files [@ingest-prompt] [@garden-prompt]. When the product needs better judgment, the happy path is to improve those prompts and manuals before adding deterministic orchestration.
