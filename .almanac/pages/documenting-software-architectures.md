---
title: Documenting Software Architectures
summary: Documenting Software Architectures is an external architecture-documentation reference whose views-and-beyond model informs how CodeAlmanac should organize durable project memory.
topics: [decisions, agents, wiki-design]
files:
  - .almanac/README.md
  - prompts/base/notability.md
  - prompts/base/syntax.md
  - prompts/operations/build.md
  - prompts/operations/absorb.md
  - prompts/operations/garden.md
sources:
  - /Users/rohan/Downloads/Documenting Software Architectures Views and Beyond, Second Edition (Safari etc.) (z-library.sk, 1lib.sk, z-lib.sk).pdf
  - /Users/rohan/.codex/sessions/2026/05/27/rollout-2026-05-27T15-50-50-019e6b34-4f03-7073-b36a-76aba85b3dcf.jsonl
status: active
verified: 2026-05-27
external_version: "Second Edition"
---

# Documenting Software Architectures

*Documenting Software Architectures: Views and Beyond* matters to CodeAlmanac because it gives a mature vocabulary for architecture memory that is organized by reader need, not by storage location. The book's core model maps cleanly onto [[wiki-organization-primitives]]: a useful architecture documentation package contains multiple views, shared beyond-view material, stakeholder-oriented navigation, rationale, interfaces, behavior, and review, rather than one linear manual or a folder tree.

## Views as reading purposes

The book divides architecture views into three major categories: module views, component-and-connector views, and allocation views. A module view explains implementation units and their responsibilities. A component-and-connector view explains runtime components, connectors, protocols, events, shared data, and control flow. An allocation view explains how software maps onto environments such as deployment infrastructure, files, teams, or work assignments.

That distinction is useful for CodeAlmanac because future agents ask different questions before editing. A change to `src/indexer/` may need a module view of responsibilities, a runtime view of query-command behavior, and an allocation view that explains which files are committed wiki source versus ignored local index state. One page can summarize a subsystem, but the wiki graph needs separate anchors or sections when those questions diverge.

## Beyond-view material

The "beyond" part is the material that applies across views or to the documentation package itself. For CodeAlmanac, this corresponds to pages and frontmatter that explain:

- system overview and project purpose through `.almanac/README.md` and [[operation-prompts]]
- how pages are organized through [[wiki-organization-primitives]]
- mappings between code, pages, topics, files, and commands through [[wikilink-syntax]], [[topic-dag]], and [[sqlite-indexer]]
- rationale for system-wide design approaches through decision pages such as [[provider-lifecycle-boundary]] and [[accidental-special-case-architecture]]
- glossary-like entity pages for recurring project terms such as provider, capture, build, absorb, garden, topic, and run

This supports the current prompt model in `prompts/base/notability.md` and `prompts/base/syntax.md`. Almanac should not only create pages about isolated facts; it should maintain the cross-page material that lets a future agent understand how those facts relate.

## Stakeholders map to agent tasks

The book chooses views from stakeholder needs and intended uses. CodeAlmanac's primary stakeholder is an AI coding agent, but the agent has multiple task modes: implementing a feature, reviewing a design, debugging a failure, inspecting a dependency, comparing competitors, or maintaining the wiki graph.

That means the wiki should expose several entry points, not only a topic list. The durable entry points are topic browsing, file-aware retrieval, backlinks, search, hubs, stale-page checks, and related-flow pages. This matches the product lesson in [[just-in-time-context-surfacing]]: the strongest experience is not a perfect table of contents, but a small cited packet surfaced at the moment a task needs it.

## Packaging implication

The book treats packaging and organization as part of making architecture documentation usable. For CodeAlmanac, packaging means the committed markdown layer, the local SQLite index, and the viewer experience together.

The committed package is `.almanac/pages/`, `.almanac/topics.yaml`, and `.almanac/README.md`. The query package is the derived [[sqlite-indexer]] and CLI commands. The human reading package is [[almanac-serve]]. These layers should present the same graph through different entry points instead of creating competing organization models.

This is the reason folders should remain navigation, not meaning. A file path can provide a primary browsing home, but a page's real structure comes from topics, wikilinks, backlinks, `files:` frontmatter, sources, lineage, and currentness.

## Review and currentness

The book separates writing architecture documentation from checking whether it satisfies stakeholder needs. CodeAlmanac's equivalent check is [[wiki-lifecycle-operations]] plus `almanac health`. Build creates the first package, Absorb incorporates new inputs, and Garden repairs graph shape after content accumulates.

The durable product requirement is that "current" be inspectable. Future pages about architecture or product direction should record sources, verification dates, related files, and supersession when knowledge changes. Git history stores edits, but frontmatter and links store the current conceptual state.

## Related pages

[[farzapedia]] is the adjacent AI-maintained wiki reference whose anti-cramming and anti-thinning rules shaped operation-prompt style. [[company-brain]] explains the broader market category for structured agent memory. [[wiki-organization-primitives]] explains the Almanac-specific primitive set that this book helps sharpen.
