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
        busy_timeout = connection.execute("PRAGMA busy_timeout").fetchone()[0]

    assert db_path.is_file()
    assert foreign_keys == 1
    assert journal_mode == "wal"
    assert busy_timeout == 30_000


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


def test_store_connections_close_after_every_use(tmp_path: Path, monkeypatch):
    from datetime import UTC, datetime

    from codealmanac.database import local
    from codealmanac.services.repositories.models import Repository
    from codealmanac.services.repositories.store import RepositoryStore

    opened: list[sqlite3.Connection] = []
    real_connect = local.connect_sqlite

    def tracking_connect(path: Path) -> sqlite3.Connection:
        connection = real_connect(path)
        opened.append(connection)
        return connection

    monkeypatch.setattr(local, "connect_sqlite", tracking_connect)
    store = RepositoryStore(tmp_path / "codealmanac.db")

    for index in range(50):
        repo_root = tmp_path / f"repo-{index}"
        store.remember(
            Repository(
                repository_id=f"w_{index:016x}",
                name=f"repo-{index}",
                description="",
                root_path=repo_root,
                almanac_path=repo_root / "almanac",
                registered_at=datetime.now(UTC),
            )
        )

    # A long agent run records hundreds of run events; sqlite3's
    # transaction-only context manager used to leak every store connection
    # until sqlite3.connect died with "unable to open database file".
    assert len(opened) == 50
    for connection in opened:
        with pytest.raises(sqlite3.ProgrammingError):
            connection.execute("SELECT 1")
