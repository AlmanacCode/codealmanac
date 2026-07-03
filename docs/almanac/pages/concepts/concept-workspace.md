---
page_id: concept-workspace
title: Workspace
summary: A workspace is the registered repository plus the Almanac root CodeAlmanac should use for that repository.
topics: [concepts, storage]
sources:
  - id: workspace-models
    type: file
    path: src/codealmanac/services/workspaces/models.py
  - id: workspace-service
    type: file
    path: src/codealmanac/services/workspaces/service.py
---

# Workspace

A workspace is CodeAlmanac's record of a repository: it has a stable workspace id, a name, a root path, an Almanac root path, and registration metadata. The workspace service resolves the current repository, remembers initialized roots, and validates that requested paths stay inside the selected workspace. [@workspace-models] [@workspace-service]

## Why does CodeAlmanac need workspaces?

Commands run from arbitrary directories. A workspace gives those commands a stable repository root and a specific `[[concept-almanac-root]]` to read or mutate.

## How is a workspace selected?

The service first looks for the nearest initialized Almanac root in known conventional roots and registered custom roots. If no on-disk root is found, it can select a registered workspace by selector. [@workspace-service]

## Where is this used?

The composition root wires `WorkspacesService` into wiki, index, runs, config, automation, diagnostics, viewer, and workflows. See `[[architecture-composition-root]]`.

