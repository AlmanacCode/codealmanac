---
title: Prompts And Manuals As Package Resources
topics: [decisions, prompts, manual]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: pyproject
    type: file
    path: pyproject.toml
  - id: prompts
    type: file
    path: src/codealmanac/prompts/
  - id: manual
    type: file
    path: src/codealmanac/manual/
---

# Prompts And Manuals As Package Resources

CodeAlmanac ships lifecycle prompts and wiki manuals as Markdown package resources. They are not embedded as Python string literals [@agreement].

## Context

The rewrite restored archived prompt/manual doctrine closely, with deliberate adaptations such as product name `codealmanac`, configured roots, public `ingest`, and dropped archive lineage fields [@agreement].

## Decision

Prompt files live under `src/codealmanac/prompts/`, manual files live under `src/codealmanac/manual/`, and package metadata includes both resource sets [@pyproject].

## Consequences

Workflows can compose base and operation prompts through [[prompt-and-manual-resources]]. Prompt changes should edit Markdown resources and tests, not Python literals.
