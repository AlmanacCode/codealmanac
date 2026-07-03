---
page_id: decision-configurable-wiki-root
title: Configurable Wiki Root
summary: Each repository owns one configured Almanac root, with `almanac/` as the default and other safe repo-relative roots allowed.
topics: [decisions, storage]
sources:
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: manual
    type: file
    path: MANUAL.md
  - id: workspace-service
    type: file
    path: src/codealmanac/services/workspaces/service.py
---

# Configurable Wiki Root

Each repository owns a configured Almanac root. New Python installs default to `almanac/`, conventional roots include `docs/almanac/` and `.almanac/`, and custom roots become discoverable after registration. [@live-agreement] [@manual] [@workspace-service]

## Status

Accepted. [@live-agreement]

## Context

Different repositories may want committed wiki files in different places, but command code needs one resolved root for reads, writes, index files, jobs, and config. [@manual] [@workspace-service]

## Decision

We will use a configurable repo-local root instead of hard-coding `.almanac/`. The initialized source marker is `topics.yaml` plus `pages/`. [@manual] [@live-agreement]

## Consequences

Implementation must use `Workspace.almanac_path` and `Workspace.almanac_root`. Wiki structure pages should put category folders under `pages/`, not beside the root files. See `[[architecture-workspaces-and-roots]]` and `[[architecture-wiki-root-layout]]`.

