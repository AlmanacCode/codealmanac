---
title: User And Repo State Paths Reference
topics: [reference, paths]
sources:
  - id: core
    type: file
    path: src/codealmanac/core/paths.py
  - id: roots
    type: file
    path: src/codealmanac/services/workspaces/roots.py
  - id: readme
    type: file
    path: README.md
  - id: runs
    type: file
    path: src/codealmanac/services/runs/service.py
---

# User And Repo State Paths Reference

This page lists CodeAlmanac's durable repo files and local machine state paths. [[workspace-registry-and-root-resolution]] explains how root selection works.

## Repo Wiki Source

- Default Almanac root: `almanac/` [@roots].
- Conventional discoverable roots: `almanac/`, `docs/almanac/`, `.almanac/` [@roots].
- Initialized marker shape: `<root>/topics.yaml` and `<root>/pages/` [@roots].
- Init scaffold: `<root>/README.md`, `<root>/topics.yaml`, `<root>/pages/`, `<root>/manual/` [@readme].

## User State

- `~/.codealmanac/registry.json`: workspace registry [@core].
- `~/.codealmanac/config.toml`: user config [@core].
- `~/.codealmanac/auth.json`: cloud auth token state [@core].
- `~/.codealmanac/capture.json`: capture state [@core].
- `~/.codealmanac/capture-events/`: capture event records [@core].
- `~/.codealmanac/control.sqlite`: local control-plane SQLite database [@core].
- `~/.codealmanac/runs/`: engine run artifact root [@core].
- `~/.codealmanac/jobs/<workspace-id>/`: lifecycle run records, specs, logs, worker locks, and sync ledger [@core] [@runs].
- `~/.codealmanac/workspaces/`: detached worker workspaces [@core].
