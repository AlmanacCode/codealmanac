def starter_readme() -> str:
    return """# CodeAlmanac Wiki

This is the living wiki for this repository. It records the durable knowledge
the code cannot say: decisions, flows, invariants, incidents, gotchas, and
project context that future agents should not rediscover from scratch.

## Notability Bar

Write a page when it preserves non-obvious knowledge that will help a future
agent work safely in this codebase.

Good pages explain:

- a decision that took research or trial-and-error
- a cross-file flow
- an invariant or gotcha not visible from one file
- an external dependency as this repo uses it
- a product or operational constraint that shapes future work

Do not write pages that restate nearby code.

## Topic Taxonomy

Topics live in `topics.yaml`. Pages live in `pages/`.

## Manual

Read `manual/README.md` before creating, reorganizing, or substantially
rewriting pages. The manual is bundled with CodeAlmanac and copied here by
`codealmanac init` and `codealmanac build`.

## Links

Use `[[page-slug]]` for page links and `[[src/path.py]]` for file references.
"""


def starter_topics_yaml() -> str:
    return """topics:
  - slug: concepts
    title: Concepts
    description: Core vocabulary and mental models for this codebase
    parents: []
  - slug: architecture
    title: Architecture
    description: System structure, boundaries, and runtime flows
    parents: []
  - slug: decisions
    title: Decisions
    description: Accepted choices and the reasoning behind them
    parents: []
  - slug: operations
    title: Operations
    description: Commands, maintenance, deployment, and recurring workflows
    parents: []
"""


def starter_page() -> str:
    return """---
title: Getting Started
topics: [concepts]
sources: []
status: active
---

# Getting Started

This starter page marks the wiki as initialized. Replace it with the first
durable reading path for this repository.
"""


def gitignore_runtime_block() -> list[str]:
    return [
        ".almanac/index.db",
        ".almanac/index.db-wal",
        ".almanac/index.db-shm",
        ".almanac/jobs/",
    ]
