---
title: App Composition Root
topics: [architecture, composition]
sources:
  - id: app
    type: file
    path: src/codealmanac/app.py
  - id: tests
    type: file
    path: tests/test_architecture.py
---

# App Composition Root

`create_app()` in [[src/codealmanac/app.py]] is the composition root for CodeAlmanac. It builds stores, services, workflows, prompt/manual libraries, harness adapters, source adapters, cloud clients, Git integrations, scheduler adapters, and worker spawners, then returns one frozen `CodeAlmanac` object used by the CLI and server [@app].

The root is where integrations meet services. Services and workflows receive ports or already-created service objects; architecture tests assert that `cli/`, `workflows/`, and `services/` do not import `codealmanac.integrations` directly [@tests]. That rule is the heart of [[services-workflows-integrations-boundary]].

When adding a new subsystem, wire it here after creating the service-owned contract. The CLI should call the resulting service or workflow through [[cli-adapter-boundary]], not construct integrations itself.
