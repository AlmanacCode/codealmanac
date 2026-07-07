---
title: No Propose/Apply Or Dry-Run
topics: [decisions, lifecycle, prompts]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo engineering manual and anti-pattern list.
  - id: live_agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Active decision that intelligence lives in prompts, not pipelines.
  - id: ingest_prompt
    type: file
    path: src/codealmanac/prompts/operations/ingest.md
    note: Ingest operation prompt algorithm.
  - id: garden_prompt
    type: file
    path: src/codealmanac/prompts/operations/garden.md
    note: Garden operation prompt algorithm and helper-agent guidance.
  - id: kernel
    type: file
    path: src/codealmanac/prompts/base/kernel.md
    note: Base writer prompt for direct durable wiki edits.
  - id: commit_policy
    type: file
    path: src/codealmanac/workflows/operations/commit.py
    note: Prompt-rendered source-control policy used instead of commit orchestration.
---

# No Propose/Apply Or Dry-Run

CodeAlmanac does not wrap wiki-writing agents in proposal files, apply steps, dry-run rehearsals, or approve/revise/reject state machines. When an operation needs judgment, the product gives an agent concrete source material, manuals, prompts, and constraints, then expects the agent to write or no-op directly [@manual][@live_agreement].

The decision is structural. CodeAlmanac owns deterministic mechanics such as repository selection, source loading, harness execution, run logging, mutation safety, indexing, and validation. The agent owns editorial judgment: what matters, what page should change, what links and topics make sense, and whether the best result is no change [@ingest_prompt][@garden_prompt].

## Context

The manual names this as a repo-specific rule: intelligence lives in prompts, not pipelines. It forbids propose/review/apply state machines, orchestration JSON schemas between writer and reviewer, and `--dry-run` rehearsals; the writer owns outcomes [@manual].

The live agreement records the same reset for the Python product. It says the happy path is the product path, old hosted assumptions and retired syntaxes should not be preserved, and auto-commit is prompt policy rather than Python-side staging or smart Git orchestration [@live_agreement]. That agreement makes proposal/apply machinery a product-direction problem, not just a missing feature.

## Decision

Lifecycle operation prompts are open algorithms, not schemas for intermediate artifacts. The ingest prompt tells the agent to understand bounded source material, inspect the current `almanac/` tree, verify important claims, prefer updating existing pages, create pages only for durable anchors, update topics and Markdown links, validate, and no-op when the source does not improve durable project knowledge [@ingest_prompt].

The Garden prompt uses the same direct-editing model at graph scale. It asks the agent to inspect pages, topics, links, hubs, referenced files, sources, and health issues; find graph problems; merge, split, revise, or no-op as needed; and validate the result [@garden_prompt]. It allows helper agents for bounded audits, but the main agent owns final synthesis, page boundaries, topics, links, hubs, and prose [@garden_prompt].

The base kernel prompt reinforces the contract. It tells agents to write or edit pages only for durable knowledge, avoid scratchpad output, use Markdown links and structured `sources:`, cite non-obvious claims, edit only wiki source unless told otherwise, and follow the runtime source-control policy [@kernel].

## Consequences

The product avoids a second editing language. There are no proposal JSON files for the agent to emit, no `--apply` flag that turns proposals into pages, and no dry-run output that pretends to be a safe substitute for doing the work. If the agent changes the wiki badly, the user reviews the normal Git diff and fixes or reverts the ordinary files.

The benefit is a smaller system with fewer stale intermediate contracts. Prompt text can evolve as writing standards change, while deterministic code stays focused on capabilities that prompts cannot provide: local state, source snapshots, run records, safety checks, and index refresh.

The cost is that prompts must be strong. Ingest and Garden have to describe durable knowledge, source handling, graph hygiene, validation, and no-op behavior clearly because there is no proposal schema to compensate for weak instructions [@ingest_prompt][@garden_prompt]. [Auto-commit is prompt policy](auto-commit-is-prompt-policy) follows from the same choice: the product gives the writer permission and constraints through a prompt-rendered source-control policy, not a hidden committer [@commit_policy].
