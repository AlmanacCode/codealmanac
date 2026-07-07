from pathlib import Path

from codealmanac.database.sqlite import SQLiteConnection, connect_sqlite


def connect_local_database(path: Path) -> SQLiteConnection:
    return connect_sqlite(path)
