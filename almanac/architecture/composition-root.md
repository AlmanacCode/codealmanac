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

`AppAdapters` is the injection surface for outside systems. It can carry harness adapters, transcript discovery adapters, source runtime adapters, a scheduler, a worker spawner, an executor spawner, a process controller, update command providers, instruction installers, global-state removers, and package uninstallers [@app-root]. Each field is optional, so production construction can use defaults while tests can pass fakes.

This design keeps provider selection at the edge. If no harness adapters are supplied, the root uses `default_harness_adapters(local_state.harness_runtime_dir)`, giving the Claude and Codex Yoke adapters and the native OpenCode adapter a product-owned cache directory under local state instead of the target repository [@app-root]. If no scheduler is supplied, automation uses `LaunchdSchedulerAdapter`. If no source adapters are supplied, the source service receives the default transcript discovery and runtime adapters [@app-root]. The services receive port implementations, not provider-specific branching logic. See [Yoke harness boundary](agent-runs/provider-adapters) for what the runtime directory is used for.

## Service Assembly

`create_services` constructs the stable service layer. It builds repository, config, automation, wiki, index, search, page, topic, health, diagnostics, tagging, update, setup, run, viewer, source, harness, and manual services [@app-root]. There is no separate prompt service; packaged Yoke agent instructions are loaded at the harness integration edge instead, as the Workflow Assembly section below explains. Store construction happens beside the service that uses the store: `RepositoriesService` receives `RepositoryStore`, `RunsService` receives `RunStore`, and `IndexService` receives `IndexStore` [@app-root].

The service graph encodes ownership. `SearchService` depends on repositories and index; `ViewerService` depends on repositories, index, runs, and Markdown rendering; `SetupService` depends on setup adapters, automation, config, and harness readiness [@app-root]. This gives callers one application object while keeping responsibilities split internally.

## Workflow Assembly

`create_workflows` constructs the [lifecycle workflow](lifecycle/workflows) layer. It creates one [Operation runner](lifecycle/operation-runner) for each run kind: build, ingest, and garden [@app-root]. Each runner receives repositories, harnesses, runs, index, and health [@app-root].

The workflows then compose services around the shared operation runner. `IngestWorkflow` receives sources, ingest operations, and manuals. `GardenWorkflow` receives index, health, garden operations, and manuals. `BuildWorkflow` receives only repositories, wiki, and build operations; it does not take a manual dependency, because `WikiService` already materializes repository-local manuals under `almanac/manual/` during initialization and the build runtime payload references that path instead of embedding manual bodies [@app-root]. Packaged Yoke agents are loaded at the harness integration edge rather than injected as a prompt-rendering service. This is the bridge to the broader [Service Boundaries](service-boundaries) rule: workflows coordinate services, but the composition root provides the machinery. See [Agents and manuals](runtime-resources/prompts-and-manuals) for why build's manual delivery now differs from ingest and garden.

`RunQueue` and `SyncWorkflow` are also assembled here. The queue receives repositories, runs, build, ingest, garden, a worker spawner, a run executor, an executor spawner, a cancellation gate, and telemetry [@app-root]. Telemetry lets `RunQueueWorker` capture structural failures from queued and scheduled runs the same way the CLI edge does; see [Telemetry](telemetry) for the event shape. Sync receives repositories, sources, the queue, and `SyncStateStore` [@app-root]. That keeps scheduled or queued execution on the same app graph as direct commands; see [Run queue and sync](lifecycle/run-queue-and-sync) for how the queue and sync scanner behave at runtime.

## Why It Stays Small

The composition root is allowed to know many names because wiring is its job. Its risk is becoming business logic. The architecture test `test_app_composition_root_stays_scannable` guards against that by capping `create_app` length and requiring named helper functions [@architecture-tests].

Future work should extend this file by adding a clear service, workflow, store, or adapter to the graph. It should not move provider imports into the CLI or service layer. The composition root is where the outside world is chosen; the rest of the application should receive already-shaped collaborators.
