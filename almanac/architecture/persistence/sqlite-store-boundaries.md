---
title: SQLite Store Boundaries
topics: [architecture, persistence, local-state]
sources:
  - id: sqlite
    type: file
    path: src/codealmanac/database/sqlite.py
    note: Shared SQLite connection and migration helpers.
  - id: local_database
    type: file
    path: src/codealmanac/database/local.py
    note: Context manager for local database schema setup and connection closing.
  - id: index_schema
    type: file
    path: src/codealmanac/services/index/schema.py
    note: Per-repository derived index schema and migrations.
  - id: index_store
    type: file
    path: src/codealmanac/services/index/store.py
    note: Store facade for refreshing and reading the per-repository derived index.
  - id: index_projection
    type: file
    path: src/codealmanac/services/index/projection.py
    note: Replacement transaction for derived index documents, topics, links, sources, and metadata.
  - id: run_tables
    type: file
    path: src/codealmanac/services/runs/tables.py
    note: Local run, event, and worker lock tables.
  - id: run_store
    type: file
    path: src/codealmanac/services/runs/store.py
    note: Run-store transaction boundaries for records, events, specs, and cancellation state.
  - id: app_root
    type: file
    path: src/codealmanac/app.py
    note: Composition root construction of stores and services.
  - id: database_tests
    type: file
    path: tests/test_database.py
    note: Tests for SQLite pragmas, migration behavior, and closed store connections.
---

# SQLite Store Boundaries

SQLite is the persistence mechanism for CodeAlmanac local state and derived indexes. Shared connection mechanics live in `codealmanac.database`, while each store package owns its schema shape, query behavior, and transaction boundaries [@sqlite] [@index_schema] [@run_tables] [@run_store]. This follows the broader [Service Boundaries](../service-boundaries) rule: stores own persistence, services own product verbs.

## Shared Mechanics

`connect_sqlite(...)` creates parent directories, opens the database with a 30 second timeout, enables row objects, sets `busy_timeout`, enables foreign keys, and uses WAL journal mode [@sqlite]. `apply_migrations(...)` applies sorted migrations above the current `PRAGMA user_version` and commits after updating the version [@sqlite].

These helpers are generic. They do not know about repositories, runs, topics, or pages. `open_local_database(...)` adds the local-store pattern on top: open a connection, execute the caller's schema, commit it, yield the connection, and close it in `finally` [@local_database]. That explicit close is load-bearing because `sqlite3.Connection`'s native context manager scopes a transaction but does not close the descriptor; the regression test records many repository writes and asserts every opened connection is closed afterward [@database_tests].

## Store-Owned Schemas

The index schema lives with the index service and defines derived tables for pages, topics, topic parents, file references, page sources, page links, cross-wiki links, FTS rows, and metadata [@index_schema]. That database is per repository: `IndexStore` receives an `almanac_path` and a repository runtime path, checks that the wiki root is initialized, and opens `index.db` below that runtime path [@index_store] [@index_schema]. `replace_documents(...)` then replaces the derived rows inside one transaction, deleting old page, topic, and FTS rows before inserting the freshly loaded documents, topic definitions, source records, links, and source signature metadata [@index_projection].

The run tables live with the run service and define `runs`, `run_events`, and `worker_locks` in the local CodeAlmanac database [@run_tables]. `RunStore` owns the multi-row transactions for run state: queueing writes the run record and initial status event together, status changes update the record and append events under `BEGIN IMMEDIATE`, and cancellation preparation or completion updates the run and event stream in the same store-owned boundary [@run_store].

The composition root wires concrete stores into their owning services [@app_root]. Future persistence work should keep that direction: add or change the store that owns the data, decide whether the data belongs in the global local database or a per-repository runtime index, and inject the store through the app root rather than opening SQLite from adapters or workflows.
