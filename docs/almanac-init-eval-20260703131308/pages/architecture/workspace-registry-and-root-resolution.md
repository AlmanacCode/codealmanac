---
title: Workspace Registry And Root Resolution
topics: [architecture, workspaces]
sources:
  - id: service
    type: file
    path: src/codealmanac/services/workspaces/service.py
  - id: roots
    type: file
    path: src/codealmanac/services/workspaces/roots.py
  - id: store
    type: file
    path: src/codealmanac/services/workspaces/store.py
  - id: tests
    type: file
    path: tests/test_workspace_registry_store.py
---

# Workspace Registry And Root Resolution

Workspace selection resolves the current repo wiki from initialized root markers or from the user registry. The service first looks for the nearest initialized root among conventional and registered roots, then registers the match into the registry when a current workspace is resolved [@service].

The marker shape is strict: `topics.yaml` and `pages/` must exist under the candidate root [@roots]. Registry data is JSON at `~/.codealmanac/registry.json`; writes are atomic and old entries are upgraded with missing fields such as `workspace_id`, description, root, and timestamp [@store].

The registry is not silently pruned. `list --drop` and `list --drop-missing` are explicit operations. Read [[concepts-configured-almanac-root]] before changing this area, and use [[user-and-repo-state-paths-reference]] for exact paths.
