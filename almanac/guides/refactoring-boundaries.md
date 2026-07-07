---
title: Refactoring Boundaries
topics: [guides, architecture]
sources:
  - id: manual
    type: file
    path: MANUAL.md
    note: Repository build philosophy and boundary rules.
  - id: cosmic-translation
    type: file
    path: docs/reference/cosmic-python/CODEALMANAC.md
    note: CodeAlmanac translation of Cosmic Python boundaries.
  - id: architecture-cleanup
    type: file
    path: docs/plans/2026-06-08-architecture-cleanup.md
    note: Example cleanup plan that removed stale public surfaces and compatibility layers.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Executable architecture constraints.
  - id: app-root
    type: file
    path: src/codealmanac/app.py
    note: Composition root that wires services, workflows, stores, ports, and integrations.
---

# Refactoring Boundaries

Use this guide when a requested change exposes mixed responsibilities, stale compatibility code, or a shape that will not hold the next feature cleanly. In this repo, refactoring is part of implementation: the unit of work is to evolve the codebase so the feature fits, then build the feature [@manual].

The successful outcome is not just fewer lines. A good refactor leaves names, modules, tests, and dependency direction clearer for the next maintainer. CodeAlmanac's boundary rule is `cli -> app -> workflows -> services -> stores/ports -> integrations`; services own product verbs, stores own persistence, ports live near the service that owns the contract, and integrations implement those ports [@cosmic-translation]. See [Service boundaries](../architecture/service-boundaries), [Composition root](../architecture/composition-root), and [Cosmic Python translation](../reference/cosmic-python-translation).

## Decide Whether The Shape Holds

Before changing code, ask what axis is varying. A new command usually belongs at the CLI adapter and a service or workflow request. A new provider belongs behind a port. A persistence change belongs with the store that owns the schema. A rendering change belongs at the CLI render edge.

If the current shape does not support the change cleanly, stop and name the architectural reason. The manual treats refusal and re-architecture as valid outputs when a feature would otherwise be bolted onto the wrong base [@manual].

Use a small wireframe in the plan or chat for non-trivial reshaping. Show the new names, call direction, and responsibility split before writing code. That is the design review surface for this repository [@manual].

## Prefer Seams Over Machinery

Build the seam when the repo has a real variation point. A seam is a boundary, typed contract, or name that lets the next case fit. Machinery is the larger dispatcher, provider fleet, compatibility path, or orchestration system. The manual says to build seams eagerly and machinery lazily [@manual].

The source and harness adapter families are examples of useful seams. The services define ports, while integrations implement provider-specific behavior and the composition root wires defaults [@app-root] [@cosmic-translation]. Do not add a one-off branch in a service when the general port model can be extended.

## Keep Dependency Direction Honest

The architecture tests make several boundary rules executable. They fail if `cli`, `workflows`, or `services` import `integrations`; if raw SQLite leaks outside the database package; if Rich terminal UI leaves CLI render code; or if the composition root stops delegating through named helpers [@architecture-tests].

Use those tests as refactor constraints. Moving code is not enough if the import direction becomes harder to explain. If a service starts knowing provider details, move that detail behind a service-owned port. If a command starts rendering in dispatch, move output back to render code. If a file becomes a facade in name but owns behavior, split it by reason to change.

## Remove Dead Exceptions

Existing special cases are not automatically legitimate. The manual says compatibility shims, provider-specific branches, fallback paths, bespoke state, and helper scripts should be treated as provisional until they earn their place [@manual].

The architecture cleanup plan is a concrete example. It removed stale Composio and connector surfaces, deprecated CLI aliases, `health --fix`, connector runtime fields, and legacy Codex exec compatibility while preserving the local GitHub ingest path that still belonged to the product [@architecture-cleanup]. That plan did not keep old public surfaces just because they existed.

When removing an exception, state why it is safe: no current caller, wrong product direction, replaced by an explicit command, or covered by a stronger general boundary. If compatibility is still needed, keep it small and document when it can be removed.

## Preserve Behavior Gates

A refactor should keep the repo buildable and behavior-covered. Run the narrow tests for the area you touched, then the default gates:

```bash
uv run pytest tests/test_architecture.py
uv run pytest
uv run ruff check .
```

For boundary refactors, add or update architecture tests when the rule is durable. The existing suite protects the composition root, topic boundaries, index read/write split, harness model split, CLI parser/dispatch/render split, viewer scope, and repository service boundaries [@architecture-tests].

## Write The Follow-Through

After the refactor, update nearby docs or wiki pages only when they would otherwise teach the old shape. Do not add broad documentation for every movement. The right note explains a durable boundary, a public behavior, or a decision future agents must preserve.

If a refactor reveals that the requested feature still does not fit, say so with the new evidence. The repo's build philosophy allows that answer; protecting the shape is part of the work [@manual].
