---
page_id: concept-codebase-wiki
title: Codebase Wiki
summary: CodeAlmanac stores durable project knowledge next to a repository as markdown plus a local index.
topics: [concepts]
sources:
  - id: readme
    type: file
    path: README.md
  - id: concepts-doc
    type: file
    path: docs/concepts.md
---

# Codebase Wiki

A CodeAlmanac codebase wiki is a local set of markdown pages that records project knowledge the code cannot express by itself: decisions, workflows, invariants, gotchas, and context from real engineering sessions. The Python product stores those pages inside a repo-local Almanac root and uses a derived SQLite index for search. [@readme] [@concepts-doc]

## What problem does it solve?

The wiki gives future maintainers a source-backed explanation layer beside the code. It is meant to answer why a subsystem is shaped a certain way before an agent changes it.

## What is the source of truth?

Markdown pages, `topics.yaml`, and manual files are the source. Runtime files such as `index.db` and `jobs/` are derived local state. [@readme]

## What should I read next?

Start with `[[concept-almanac-root]]`, then read `[[architecture-system-overview]]` for the full Python implementation map.

