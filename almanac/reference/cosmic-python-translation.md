---
title: Cosmic Python Translation
topics: [reference, architecture]
sources:
  - id: cosmic-notes
    type: file
    path: docs/reference/cosmic-python/CODEALMANAC.md
  - id: service-layer
    type: file
    path: docs/reference/cosmic-python/chapter_04_service_layer.md
  - id: dependency-injection
    type: file
    path: docs/reference/cosmic-python/chapter_13_dependency_injection.md
  - id: manual
    type: file
    path: MANUAL.md
  - id: app-root
    type: file
    path: src/codealmanac/app.py
---

# Cosmic Python Translation

CodeAlmanac uses *Architecture Patterns with Python* as an architecture reference, not as a package template. The local translation is the dependency direction `cli -> app -> workflows -> services -> stores/ports -> integrations` [@cosmic-notes]. This page records how that translation maps the book's service layer, repository, unit of work, adapters, and composition root ideas into this repository.

The rule is practical: user-facing adapters stay thin, product verbs live in services and workflows, persistence belongs to stores, ports are owned by the service that needs the capability, integrations implement those ports, and `src/codealmanac/app.py` wires the graph [@cosmic-notes] [@app-root]. The same shape is described in [service boundaries](../architecture/service-boundaries) and assembled in the [composition root](../architecture/composition-root).

## Translation Table

| Cosmic Python idea | CodeAlmanac translation |
|---|---|
| Service layer | `src/codealmanac/services/*/service.py` owns product verbs and use cases [@cosmic-notes]. |
| Repository pattern | `store.py`, `*_store.py`, and store fakes own persistence access [@cosmic-notes]. |
| Unit of Work | Explicit SQLite transaction ownership inside services and workflows [@cosmic-notes]. |
| External event adapters | Transcript, GitHub, Git, harness, scheduler, and source-runtime adapters normalize outside shapes into service-owned models [@cosmic-notes]. |
| Bootstrap or composition root | `src/codealmanac/app.py` builds services, stores, adapters, workflows, prompts, manuals, and local state [@cosmic-notes] [@app-root]. |
| Ports and adapters | `services/*/ports.py` defines the contract; `integrations/*` implements it [@cosmic-notes]. |
| Command objects | Pydantic request models carry shaped input across CLI, workflow, and service boundaries [@cosmic-notes]. |

## Service Layer

Chapter 4 frames a service layer as the place that defines system use cases and separates orchestration from interfacing code [@service-layer]. CodeAlmanac translates that into services such as `RepositoriesService`, `SearchService`, `RunsService`, `SourcesService`, and `HarnessesService`, each exposed on the application object returned by `create_app` [@app-root].

The CLI is therefore an adapter, not the internal API. Parser and dispatch code should build typed requests and call services or workflows. Product behavior belongs behind those calls. This is the same boundary described by [request models](../architecture/request-models).

## Stores And Transactions

The local notes map the repository pattern to store modules and store fakes [@cosmic-notes]. In this repo, stores own schema-specific persistence behavior while services own the product verbs that use the data.

The local notes also translate Unit of Work into explicit SQLite transaction ownership inside services and workflows [@cosmic-notes]. CodeAlmanac does not introduce a generic unit-of-work framework for every operation. The transfer is the boundary: transaction responsibility should be visible at the service or workflow that owns the product operation.

## Ports And Integrations

Ports live near the service that owns the contract. Integrations implement those ports [@cosmic-notes]. This keeps external systems out of core service code.

Examples in the current app graph include `HarnessAdapter`, `SourceRuntimeAdapter`, `TranscriptDiscoveryAdapter`, `SchedulerAdapter`, `RunWorkerSpawner`, update command providers, setup installers, and uninstallers [@app-root]. `create_services` and `create_workflows` receive those adapters through the app-level injection surface, while services depend on the service-owned contract rather than provider modules [@app-root].

This follows the manual's boundary rule: raw external shapes should be parsed at the edge into typed values, and downstream code should not depend on the raw payload [@manual].

## Composition Root

Chapter 13 presents the composition root as the place that prepares dependencies so entrypoints do not perform setup themselves [@dependency-injection]. CodeAlmanac's composition root is `src/codealmanac/app.py`; `create_app` builds local state, collects optional adapter overrides, creates services, creates workflows, and returns the assembled application [@app-root].

`AppAdapters` is the override surface for tests and alternate implementations. When a field is not supplied, the composition root chooses the production default, such as default harness adapters, default source runtime adapters, `LaunchdSchedulerAdapter`, or `SubprocessRunWorkerSpawner` [@app-root].

## Dependency Direction

The dependency rule is:

```text
cli
  -> app
    -> workflows
      -> services
        -> stores
        -> ports
          -> integrations
```

This is the CodeAlmanac-specific reading of the book, not a general Python package law [@cosmic-notes]. The shape lets commands, tests, scheduled workers, and future entrypoints share the same service/workflow layer while changing external adapters at the composition root.

## What Not To Copy

The vendored book files are reference material. The local note says not to rewrite, abridge, rearrange, or edit the book text, and to put CodeAlmanac-specific interpretation in repo docs or wiki pages [@cosmic-notes].

CodeAlmanac should also avoid copying architecture machinery just because the book names it. The manual's seam rule says to build boundaries eagerly, but defer speculative machinery until there is a real need [@manual]. In practice, that means a clear service, store, port, or adapter is welcome when it names a real responsibility; a framework or generalized dispatcher needs stronger evidence.

For boundary changes, use the local translation first, then check the relevant architecture page or guide. The main related pages are [service boundaries](../architecture/service-boundaries), [composition root](../architecture/composition-root), and [refactoring boundaries](../guides/refactoring-boundaries).
