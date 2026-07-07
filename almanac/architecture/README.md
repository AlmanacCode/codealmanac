---
title: Architecture
summary: Map of the Python product boundaries.
topics: [architecture]
sources:
  - id: app
    type: file
    path: src/codealmanac/app.py
    note: Composition root for services, integrations, and workflows.
  - id: agreement
    type: file
    path: docs/python-port-live-agreement.md
    note: Architecture agreement for the Python rewrite.
  - id: manual
    type: file
    path: MANUAL.md
    note: Repo-specific build rules.
---

# Architecture

The Python product uses `src/codealmanac/app.py` as the composition root for services, workflows, and integrations [@app]. The current agreement says services own product verbs, stores own persistence, integrations implement ports, and CLI dispatch stays a thin adapter [@agreement].

The main architecture neighborhoods are:

- [Wiki Tree](wiki-tree): committed wiki files under `almanac/`.
- [Indexing](indexing): derived SQLite read model.
- [Local Viewer](viewer): read-only browser surface for wiki and run data.
- [Runs](runs): build, ingest, and garden execution through the shared operation runner.
- [Providers](providers): Codex and Claude harness adapters.
- [Sync And Automation](sync-and-automation): transcript sync and launchd jobs.

The build rule is to reshape the codebase so a feature fits before building it [@manual]. That rule matters here because the branch is rebuilding the local Python product from the `e773dc0b` fork point, not extending the later hosted product.
