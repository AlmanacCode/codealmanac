---
page_id: decision-prompts-not-pipelines
title: Prompts Not Pipelines
summary: Judgment about wiki content belongs in prompts and harnesses, not in proposal files or orchestration state machines.
topics: [decisions, lifecycle]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: prompt-renderer
    type: file
    path: src/codealmanac/prompts/renderer.py
  - id: ingest
    type: file
    path: src/codealmanac/workflows/ingest/service.py
  - id: garden
    type: file
    path: src/codealmanac/workflows/garden/service.py
---

# Prompts Not Pipelines

CodeAlmanac keeps judgment in prompts and agent execution rather than adding proposal, review, apply, or dry-run orchestration flows. Ingest and garden render prompt sections plus runtime context and hand that prompt to the selected harness. [@manual] [@prompt-renderer] [@ingest] [@garden]

## Status

Accepted. [@manual]

## Context

Deciding what durable knowledge to write requires judgment. The repo manual says intelligence lives in prompts, not pipelines, and rejects propose/review/apply state machines and dry-run rehearsals. [@manual]

## Decision

We will extend prompts and manual guidance when wiki-writing judgment changes, instead of adding intermediate proposal machinery. [@manual]

## Consequences

Prompt quality and source context matter more than orchestration schemas. Pages about lifecycle work should link to `[[architecture-prompts-and-manuals]]` when explaining how content judgment enters the system.

