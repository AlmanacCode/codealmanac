---
page_id: concept-almanac-root
title: Almanac Root
summary: The Almanac root is the repo-local directory that owns wiki source files and local runtime artifacts.
topics: [concepts, storage]
sources:
  - id: manual
    type: file
    path: MANUAL.md
  - id: live-agreement
    type: file
    path: docs/python-port-live-agreement.md
  - id: roots
    type: file
    path: src/codealmanac/services/workspaces/roots.py
---

# Almanac Root

An Almanac root is the repository directory that contains `README.md`, `topics.yaml`, `pages/`, and `manual/`. The Python rewrite defaults new repositories to `almanac/`, also detects `docs/almanac/` and `.almanac/`, and allows other configured repo-relative roots. [@manual] [@live-agreement] [@roots]

## What makes a root initialized?

The root is initialized when it has both `topics.yaml` and `pages/`. `README.md` is guidance, not a detection marker. [@manual]

## Where does runtime state go?

The root may later contain derived runtime files such as `index.db` and `jobs/`. Those files are local machine state and should not be treated as committed wiki source. [@manual]

## What uses this concept?

`[[architecture-workspaces-and-roots]]` explains how roots are discovered, and `[[reference-root-layout]]` lists the exact files.

