---
title: Service Boundaries
topics: [architecture]
sources:
  - id: cosmic-translation
    type: file
    path: docs/reference/cosmic-python/CODEALMANAC.md
    note: Local translation of Cosmic Python dependency rules into CodeAlmanac shape.
  - id: app-root
    type: file
    path: src/codealmanac/app.py
    note: Composition root that wires services, workflows, stores, ports, and integrations.
  - id: architecture-tests
    type: file
    path: tests/test_architecture.py
    note: Tests that enforce import direction, composition-root size, render ownership, and boundary splits.
---

# Service Boundaries

CodeAlmanac uses service boundaries to keep product behavior out of adapters and provider code. The intended dependency direction is `cli -> app -> workflows -> services -> stores/ports -> integrations`, with `src/codealmanac/app.py` as the place where those layers are assembled [@cosmic-translation] [@app-root]. This means a command, server wrapper, worker, or test should call a service or workflow through a typed request, while provider-specific code stays behind a port.

The boundary matters because this repository is a local product with many edges: terminal commands, local SQLite state, scheduled automation, source runtimes, and agent harnesses. The code shape keeps those edges from becoming the core. Tests make that rule executable by failing if `cli`, `workflows`, or `services` import `integrations` directly [@architecture-tests].

## Dependency Rule

The repo's local Cosmic Python note translates the book into a CodeAlmanac-specific rule: services own product verbs, stores own persistence, ports live near the service that owns the contract, and integrations implement those ports [@cosmic-translation]. The application object returned by `create_app` exposes services such as `repositories`, `search`, `health`, `runs`, `sources`, and `harnesses`, plus lifecycle workflows under `workflows` [@app-root].

This is not a generic layering diagram. In CodeAlmanac, `SearchService` is the product verb for searching pages, `RunsService` owns run records and events, `SourcesService` owns source resolution, and `HarnessesService` owns the agent-run provider contract. Their collaborators are injected from the [Composition Root](composition-root), so the services do not need to know whether the harness is Codex, Claude, or a fake in a test [@app-root].

## Workflows Above Services

Workflows coordinate product operations that cross service boundaries. Build, ingest, garden, queued runs, and sync are assembled together as `CodeAlmanacWorkflows` [@app-root]. For example, ingest needs sources, runs, operation execution, typed runtime context, and manuals; it is therefore a workflow rather than a single service call.

The boundary is that workflows may orchestrate services, but they still should not reach into integrations. The architecture tests enforce this by including `workflows` in the same "must not import integrations" rule as the CLI and services [@architecture-tests]. That keeps lifecycle orchestration provider-neutral.

## Stores And Ports

Persistence and outside systems sit below services, but they are different kinds of dependencies. Stores such as `RepositoryStore`, `IndexStore`, `RunStore`, `ConfigStore`, and `SyncStateStore` are constructed in the composition root and handed to the service that owns the data [@app-root]. Ports such as `HarnessAdapter`, `SourceRuntimeAdapter`, `TranscriptDiscoveryAdapter`, `SchedulerAdapter`, and `RunWorkerSpawner` describe outside capabilities in service-owned terms [@app-root].

Integrations implement those ports. The composition root chooses defaults such as `LaunchdSchedulerAdapter`, `SubprocessRunWorkerSpawner`, default harness adapters, and default source runtime adapters [@app-root]. This preserves a clear rule: the core asks for a capability, and the integration decides how to talk to the outside world.

## Enforced Shape

Several tests protect the boundary as architecture, not style. `test_cli_workflows_and_services_do_not_import_integrations` blocks imports that would reverse the dependency rule. `test_database_package_owns_sqlite_imports` keeps raw SQLite use inside the database package. Other architecture tests keep CLI render, dispatch, index views, and setup responsibilities split by owner [@architecture-tests].

The result is a codebase where a new feature should first find its owner. If it is a user verb, it usually belongs in a service or workflow. If it speaks to Git, launchd, a provider SDK, subprocesses, or local files outside the product model, it usually belongs behind a port implemented under `integrations`. When a command crosses into the system, [Request Models](request-models) carry the shaped input instead of passing raw adapter state inward.
