---
title: SQLite Store Boundaries
topics: [architecture, persistence, local-state]
sources:
  - id: sqlite
    type: file
    path: src/codealmanac/database/sqlite.py
    note: Shared SQLite connection and migration helpers.
  - id: index_schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: Per-repository derived index schema and migrations.
  - id: run_tables
    type: file
    path: src/codealmanac/services/runs/tables.py
    note: Local run, event, and worker lock tables.
  - id: app_root
    type: file
    path: src/codealmanac/app.py
    note: Composition root construction of stores and services.
---

# SQLite Store Boundaries

SQLite is the persistence mechanism for CodeAlmanac local state and derived indexes. Shared connection mechanics live in `codealmanac.database`, while each store package owns its schema and query behavior [@sqlite] [@index_schema] [@run_tables]. This follows the broader [Service Boundaries](../service-boundaries) rule: stores own persistence, services own product verbs.

## Shared Mechanics

`connect_sqlite(...)` creates parent directories, opens the database with a 30 second timeout, enables row objects, sets `busy_timeout`, enables foreign keys, and uses WAL journal mode [@sqlite]. `apply_migrations(...)` applies sorted migrations above the current `PRAGMA user_version` and commits after updating the version [@sqlite].

These helpers are generic. They do not know about repositories, runs, topics, or pages.

## Store-Owned Schemas

The index schema lives with the index service and defines derived tables for pages, topics, topic parents, file references, page sources, page links, cross-wiki links, FTS rows, and metadata [@index_schema]. The run tables live with the run service and define `runs`, `run_events`, and `worker_locks` [@run_tables].

The composition root wires concrete stores into their owning services [@app_root]. Future persistence work should keep that direction: add or change the store that owns the data, then inject it through the app root rather than opening SQLite from adapters or workflows.
