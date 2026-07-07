---
title: Repository Local State
topics: [architecture, repositories, local-state]
sources:
  - id: settings
    type: file
    path: src/codealmanac/settings.py
    note: AppConfig defaults and LocalStatePaths layout.
  - id: core-paths
    type: file
    path: src/codealmanac/core/paths.py
    note: Home, state directory, default database path, default config path, and path normalization.
  - id: repository-service
    type: file
    path: src/codealmanac/services/repositories/service.py
    note: Repository registration, selection, validation, and database path exposure.
  - id: repository-store
    type: file
    path: src/codealmanac/services/repositories/store.py
    note: Repository row persistence in the local database.
  - id: repository-tables
    type: file
    path: src/codealmanac/services/repositories/tables.py
    note: SQLite schema for registered repository rows.
  - id: app-root
    type: file
    path: src/codealmanac/app.py
    note: Composition root wiring of local state into services and stores.
  - id: repo-readme
    type: file
    path: README.md
    note: Public runtime state description.
---

# Repository Local State

Repository local state is the runtime state CodeAlmanac keeps outside the committed wiki. The authored wiki lives under `almanac/`, while the global database, user config, update lock, and per-repository runtime directories live under the product-specific state directory `~/.codealmanac/` [@repo-readme] [@core-paths]. This split lets Markdown stay reviewable in Git while search indexes, run records, and other derived state can be rebuilt or managed locally.

The local-state boundary is owned by `AppConfig` and `LocalStatePaths`. `AppConfig` defaults the database to `~/.codealmanac/codealmanac.db` and the user config to `~/.codealmanac/config.toml`; both paths are normalized through `expanduser().resolve(strict=False)` [@settings] [@core-paths]. `LocalStatePaths` then derives the state directory from the database parent and rejects a database path that is not directly inside that state directory [@settings].

## What Lives There

The global local database is the durable registry for repositories and other local runtime records. Repository rows are stored in `codealmanac.db`, not inside any repo's `almanac/` tree [@repository-store]. The repository table records `repository_id`, `name`, `description`, `root_path`, `almanac_root`, and `registered_at`, with unique constraints on repository id, name, and root path [@repository-tables].

Per-repository runtime files live below `~/.codealmanac/repos/<repo-id>/`. `LocalStatePaths.repository_dir(...)` constructs that directory, and the index service uses it for each repository's derived `index.db` [@settings] [@app-root]. The same local-state object also exposes `update.lock`, which the update service receives from the app composition root [@settings] [@app-root].

## Repository Rows

`RepositoriesService.register(...)` turns a repo root into a normalized repository record. It derives the fixed `almanac/` path from the root, preserves an existing row's registration time when re-registering the same root, and writes the row through `RepositoryStore.remember(...)` [@repository-service] [@repository-store]. The store uses an upsert keyed by `repository_id`, so the row can be refreshed without creating a second registry entry for the same repository [@repository-store].

The local database is also the lookup surface for command flows. The repository service can fetch by id, find by root path, list registered repositories, and expose the underlying database path for diagnostics [@repository-service]. That keeps repository identity centralized instead of making each command rediscover local state.

## Config And Locks

User config is local state, not repo source. `AppConfig` reads `CODEALMANAC_` environment variables and otherwise uses the default config path under `~/.codealmanac/` [@settings]. If only the database path is customized, `LocalStatePaths.from_config(...)` keeps config beside that database unless the config path was explicitly set [@settings].

The update lock is also global state. `LocalStatePaths.update_lock_path` returns `~/.codealmanac/update.lock`, and the app composition root passes that path to `UpdatesService` with the local database path [@settings] [@app-root]. That shape makes scheduled package update coordination a global product concern rather than a wiki-file concern.

## Boundary With The Wiki

The important invariant is simple: authored knowledge goes in `almanac/`; runtime state goes in `~/.codealmanac/`. Repository local state may remember which repositories exist and hold derived indexes for them, but it does not make SQLite files part of the committed wiki [@repo-readme]. For the exact runtime layout, see [Local state layout](../../reference/local-state-layout). For the persistence boundary behind the database stores, see [SQLite store boundaries](../persistence/sqlite-store-boundaries). The product decision behind this split is [Local-only Python product](../../decisions/local-only-python-product).
