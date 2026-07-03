---
title: Python Local Rewrite Decision
topics: [decisions, python]
sources:
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: readme
    type: file
    path: README.md
  - id: archive
    type: file
    path: archive/code/
---

# Python Local Rewrite Decision

CodeAlmanac's active implementation is the Python rewrite under `src/codealmanac/`. The archived TypeScript/Node implementation remains under `archive/code/` as behavior reference, not as code to preserve [@agreement].

## Context

The live agreement says Python v1 is a local product and targets new CodeAlmanac users. It also says archived behavior should be ported unless a later decision explicitly drops it, especially setup UX, lifecycle semantics, harness events, page provenance, and viewer scope [@agreement].

## Decision

Future work should change the Python source tree, use the archive only to understand intended behavior, and avoid TypeScript-era compatibility layers unless the decision is reopened [@agreement].

## Consequences

Docs and tests treat Python packaging, `uv`, pytest, and ruff as the active gates [@readme]. Architecture pages such as [[app-composition-root]] and [[cli-adapter-boundary]] describe Python runtime shape, not the archive.
