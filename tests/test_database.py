import sqlite3
from pathlib import Path

import pytest
from pydantic import ValidationError

from codealmanac.database import SQLiteMigration, apply_migrations, connect_sqlite


def test_connect_sqlite_creates_parent_and_applies_pragmas(tmp_path: Path):
    db_path = tmp_path / "nested" / "index.db"

    with connect_sqlite(db_path) as connection:
        foreign_keys = connection.execute("PRAGMA foreign_keys").fetchone()[0]
        journal_mode = connection.execute("PRAGMA journal_mode").fetchone()[0]

    assert db_path.is_file()
    assert foreign_keys == 1
    assert journal_mode == "wal"


def test_apply_migrations_runs_each_version_once(tmp_path: Path):
    db_path = tmp_path / "index.db"
    migrations = (
        SQLiteMigration(
            version=1,
            sql="CREATE TABLE once_only (slug TEXT PRIMARY KEY);",
        ),
        SQLiteMigration(
            version=2,
            sql="CREATE TABLE twice_only (slug TEXT PRIMARY KEY);",
        ),
    )

    with sqlite3.connect(db_path) as connection:
        apply_migrations(connection, migrations)
        apply_migrations(connection, migrations)
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

    assert version == 2
    assert {"once_only", "twice_only"}.issubset(tables)


def test_sqlite_migration_validates_version_and_sql():
    with pytest.raises(ValidationError, match="version must be positive"):
        SQLiteMigration(version=0, sql="SELECT 1;")

    with pytest.raises(ValidationError, match="SQLite migration SQL"):
        SQLiteMigration(version=1, sql=" ")
