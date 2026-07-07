---
title: Composition Root
topics: [architecture]
sources:
  - id: app-root
    type: file
    path: src/codealmanac/app.py
    note: CodeAlmanac composition root and application assembly.
  - id: cosmic-translation
    type: file
    path: docs/reference/cosmic-python/CODEALMANAC.md
    note: Local note mapping bootstrap and dependency injection ideas into this repo.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Tests that keep create_app scannable and enforce dependency boundaries.
---

# Composition Root

The composition root is `src/codealmanac/app.py`. It is the one place that builds the CodeAlmanac application graph: local state paths, stores, services, adapters, operation runners, and lifecycle workflows [@app-root]. This follows the repo's Cosmic Python translation, where bootstrap lives in the application root so entrypoints do not perform setup themselves [@cosmic-translation].

`create_app` is the public construction function. It accepts optional adapter overrides, builds the default `AppConfig` and `LocalStatePaths`, gathers the overrides into `AppAdapters`, creates services, creates workflows, and returns a frozen `CodeAlmanac` object [@app-root]. Tests keep this function short and require it to delegate to `create_services`, `create_workflows`, and `assemble_app` [@architecture-tests].

## Adapter Injection

`AppAdapters` is the injection surface for outside systems. It can carry harness adapters, transcript discovery adapters, source runtime adapters, a scheduler, a worker spawner, update command providers, instruction installers, global-state removers, and package uninstallers [@app-root]. Each field is optional, so production construction can use defaults while tests can pass fakes.

This design keeps provider selection at the edge. If no harness adapters are supplied, the root uses `default_harness_adapters()`. If no scheduler is supplied, automation uses `LaunchdSchedulerAdapter`. If no source adapters are supplied, the source service receives the default transcript discovery and runtime adapters [@app-root]. The services receive port implementations, not provider-specific branching logic.

## Service Assembly

`create_services` constructs the stable service layer. It builds repository, config, automation, wiki, index, search, page, topic, health, diagnostics, tagging, update, setup, run, viewer, source, harness, prompt, and manual services [@app-root]. Store construction happens beside the service that uses the store: `RepositoriesService` receives `RepositoryStore`, `RunsService` receives `RunStore`, and `IndexService` receives `IndexStore` [@app-root].

The service graph encodes ownership. `SearchService` depends on repositories and index; `ViewerService` depends on repositories, index, runs, and Markdown rendering; `SetupService` depends on setup adapters, automation, config, and harness readiness [@app-root]. This gives callers one application object while keeping responsibilities split internally.

## Workflow Assembly

`create_workflows` constructs the lifecycle layer. It creates one `OperationRunner` for each run kind: build, ingest, and garden [@app-root]. Each runner receives repositories, harnesses, runs, index, health, and an `OperationMutationPolicy` backed by `GitRepositoryChangeProbe` for that kind [@app-root].

The workflows then compose services around the shared operation runner. `IngestWorkflow` receives sources, runs, ingest operations, prompts, and manuals. `GardenWorkflow` receives runs, index, health, garden operations, prompts, and manuals. `BuildWorkflow` receives repositories, wiki, runs, build operations, prompts, and manuals [@app-root]. This is the bridge to the broader [Service Boundaries](service-boundaries) rule: workflows coordinate services, but the composition root provides the machinery.

`RunQueue` and `SyncWorkflow` are also assembled here. The queue receives repositories, runs, ingest, garden, and a worker spawner. Sync receives repositories, sources, the queue, and `SyncStateStore` [@app-root]. That keeps scheduled or queued execution on the same app graph as direct commands.

## Why It Stays Small

The composition root is allowed to know many names because wiring is its job. Its risk is becoming business logic. The architecture test `test_app_composition_root_stays_scannable` guards against that by capping `create_app` length and requiring named helper functions [@architecture-tests].

Future work should extend this file by adding a clear service, workflow, store, or adapter to the graph. It should not move provider imports into the CLI or service layer. The composition root is where the outside world is chosen; the rest of the application should receive already-shaped collaborators.
