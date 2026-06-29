import sqlite3
from pathlib import Path

from pydantic import field_validator

from codealmanac.core.models import CodeAlmanacModel
from codealmanac.core.text import required_text

type SQLiteConnection = sqlite3.Connection
type SQLiteRow = sqlite3.Row


class SQLiteMigration(CodeAlmanacModel):
    version: int
    sql: str

    @field_validator("version")
    @classmethod
    def positive_version(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("SQLite migration version must be positive")
        return value

    @field_validator("sql")
    @classmethod
    def require_sql(cls, value: str) -> str:
        return required_text(value, "SQLite migration SQL")


def connect_sqlite(path: Path) -> SQLiteConnection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


def apply_migrations(
    connection: SQLiteConnection,
    migrations: tuple[SQLiteMigration, ...],
) -> None:
    current = user_version(connection)
    for migration in sorted(migrations, key=lambda item: item.version):
        if migration.version <= current:
            continue
        connection.executescript(migration.sql)
        connection.execute(f"PRAGMA user_version = {migration.version}")
        current = migration.version
    connection.commit()


def user_version(connection: SQLiteConnection) -> int:
    return int(connection.execute("PRAGMA user_version").fetchone()[0])
