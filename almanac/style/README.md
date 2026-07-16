---
title: Style
topics: [style, overview]
sources:
  - id: agents
    type: file
    path: AGENTS.md
    note: Repo instruction that style principles live in the wiki and should be read before large writes or refactors.
  - id: manual
    type: file
    path: MANUAL.md
    note: Living-architecture, seam-versus-machinery, naming, typing, and boundary rules.
  - id: refactoring-boundaries
    type: wiki
    path: guides/refactoring-boundaries
    note: Task guide for reshaping code around existing architecture boundaries.
  - id: service-boundaries
    type: wiki
    path: architecture/service-boundaries
    note: Architecture page for dependency direction and service/workflow/store/port ownership.
  - id: terminal-output
    type: wiki
    path: architecture/cli/terminal-output
    note: Architecture page that treats CLI text, JSON, stderr, color, and table behavior as product behavior.
---

# Style

Style in CodeAlmanac is the set of engineering principles that keep code changes easy for future agents to extend. The repo instructions tell agents to read the style topic before large writes or refactors, but the principles are not cosmetic: they cover architecture fit, responsibility boundaries, typed contracts, terminal behavior, and when to remove special cases [@agents] [@manual]. This page is the hub for those standing rules.

The shortest version is: reshape the code so the feature fits, then build the feature. The manual makes that the unit of work and treats refusal or re-architecture as valid when a requested feature would otherwise be bolted onto the wrong shape [@manual]. For the task procedure, use [Refactoring boundaries](../guides/refactoring-boundaries).

## Architecture Fit

Start every non-trivial change by asking where the variation belongs. CodeAlmanac's dependency direction is `cli -> app -> workflows -> services -> stores/ports -> integrations`; services own product verbs, stores own persistence, ports name outside capabilities, and integrations implement those ports [@service-boundaries] [@refactoring-boundaries]. If a new command, provider, store, or renderer does not fit that direction, the style rule is to name the mismatch before writing the local workaround.

The manual's seam-versus-machinery rule is the main design taste. Build the seam when a boundary, typed contract, or name makes a real variation point clear. Defer machinery such as dispatcher fleets, broad compatibility paths, or provider frameworks until there is evidence they are needed [@manual]. This keeps the codebase open to the next feature without turning one case into a system.

## Code Shape

Names are part of the architecture. A concept that has a stable role should get a first-class home instead of hiding behind an internal helper or a pile of conditionals [@manual]. The refactoring guide applies that rule to this repo: split by reason to change, keep dependency direction honest, and remove dead exceptions once callers have moved [@refactoring-boundaries].

Structured data should move through typed models rather than loose dictionaries, raw provider payloads, or scraped text. The manual allows opaque external passthrough only when it is deliberate and documented; otherwise, parse once at the edge and pass shaped values inward [@manual]. That rule pairs with [Service boundaries](../architecture/service-boundaries), where provider-specific details stay behind service-owned ports.

## User-Facing Behavior

Terminal output is style and behavior. CLI human text, JSON output, stderr placement, color behavior, table formatting, and empty-result messages are owned by render modules and protected by tests [@terminal-output]. A service should return structured data; the CLI render edge decides how that data appears to humans and scripts.

When changing command output, treat wording and stream placement as product surface. Update structured service fields first, then adapt the renderer and tests that own the visible contract [@terminal-output].

## Reading Path

For a large implementation or refactor, read these pages in order:

1. [Refactoring boundaries](../guides/refactoring-boundaries) for the working procedure.
2. [Service boundaries](../architecture/service-boundaries) for dependency direction and ownership.
3. [Cosmic Python translation](../reference/cosmic-python-translation) for the local architecture vocabulary.
4. [Terminal output](../architecture/cli/terminal-output) when changing command text, JSON, stderr, color, or tables.
