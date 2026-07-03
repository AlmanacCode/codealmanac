---
page_id: manual-page-types
title: Page Types
summary: How to choose between concepts, architecture, guides, decisions, and reference.
topics: [manual]
sources:
  - id: structure-plan
    type: file
    path: docs/plans/opinionated-wiki-structure.md
---

# Page Types

This wiki uses five page families because each family answers a different kind of reader need: concepts define vocabulary, architecture explains system shape, guides help maintainers complete tasks, decisions record why a choice was made, and reference pages provide exact lookup facts. [@structure-plan]

| Folder | Use it when the reader asks |
|---|---|
| `concepts/` | "What does this term mean?" |
| `architecture/` | "How does this part of the system fit together?" |
| `guides/` | "How do I complete this task?" |
| `decisions/` | "Why was this choice made?" |
| `reference/` | "What exactly are the fields, flags, states, or rules?" |

## Where do ambiguous pages go?

If the page tells a story about the system, put it in architecture. If it is a recipe, put it in guides. If it is a table of exact facts, put it in reference. If it exists to preserve rationale, put it in decisions.

For the writing and evidence rules that apply to every page type, read `[[manual-writing-style]]` and `[[manual-sourcing-and-linking]]`.
