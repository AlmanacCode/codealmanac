# Slice 38 - Database Boundary

Date: 2026-06-29

## Scope

This slice creates the Python `database/` package promised by the live
agreement. It moves SQLite connection setup and migration application out of
`services/index/store.py` without changing the index read model behavior.

## Shape

```python
from codealmanac.database import SQLiteMigration, apply_migrations, connect_sqlite

INDEX_MIGRATIONS = (
    SQLiteMigration(version=SCHEMA_VERSION, sql=f"{DROP_DDL}\n{SCHEMA_DDL}"),
)

def connect_index(path):
    connection = connect_sqlite(path)
    apply_migrations(connection, INDEX_MIGRATIONS)
    return connection
```

The database package owns:

- parent directory creation for SQLite files
- `sqlite3.Row` row factory setup
- `PRAGMA foreign_keys = ON`
- `PRAGMA journal_mode = WAL`
- applying typed migration scripts in version order

The index store still owns:

- `index.db` file location
- schema DDL for pages, topics, refs, links, FTS, and metadata
- read-model refresh/rebuild behavior
- search/topic/page/health SQL
- row conversion into index service models

## Prior Art

Alembic, yoyo, and sqlite-utils all provide migration machinery. This slice
does not add one of them because CodeAlmanac's current SQLite database is
`.almanac/index.db`, a disposable derived read model rebuilt from committed
wiki files. A full migration runner would be useful once CodeAlmanac has a
long-lived writable SQLite store whose rows are not derivable from
`.almanac/pages/` and `topics.yaml`.

## Cosmic Python Note

Chapter 2's Repository pattern separates product persistence behavior from
infrastructure mechanics. Chapter 6's Unit of Work pattern treats atomic
database setup and commit boundaries as their own concern. In this slice,
`IndexStore` remains the repository for the read model, while `database/`
becomes the owner of SQLite mechanics.

## Verification Plan

- database helper tests
- read-model regression tests
- architecture test that direct `sqlite3` imports are confined to `database/`
- focused ruff
- full pytest
- full ruff
- `git diff --check`
- live `build` + `search` dogfood in an isolated temp repo
