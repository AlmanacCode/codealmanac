---
page_id: architecture-workspaces-and-roots
title: Workspaces And Roots
summary: Workspace resolution maps a command's current directory to the repo root and Almanac root that the command should use.
topics: [architecture, storage]
sources:
  - id: workspace-service
    type: file
    path: src/codealmanac/services/workspaces/service.py
  - id: workspace-roots
    type: file
    path: src/codealmanac/services/workspaces/roots.py
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
---

# Workspaces And Roots

Workspace resolution is the boundary that decides which repository and which `[[concept-almanac-root]]` a command should use. The service normalizes paths, detects initialized conventional roots, registers discovered workspaces, selects registered entries, and validates paths against the workspace root. [@workspace-service] [@workspace-roots]

## What roots are discoverable?

The Python rewrite treats `almanac/`, `docs/almanac/`, and `.almanac/` as conventional roots. Other roots become discoverable after registration. [@live-agreement] [@workspace-service]

## What wins: disk or registry?

Current-repo auto-detection prefers the nearest initialized root on disk over broad parent registry entries. Registry entries are still not auto-dropped just because a path is unavailable. [@live-agreement]

## What does this protect?

Every service that reads or writes wiki state gets a workspace before touching files. That keeps commands rooted in the selected repository and prevents accidental use of a neighboring wiki. [@workspace-service]

