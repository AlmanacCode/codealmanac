from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from codealmanac.database.sqlite import SQLiteConnection, connect_sqlite


@contextmanager
def open_local_database(path: Path, schema: str) -> Iterator[SQLiteConnection]:
    # sqlite3.Connection's own context manager scopes a transaction and never
    # closes; long agent runs record hundreds of events and leaked descriptors
    # until sqlite3.connect failed with "unable to open database file".
    connection = connect_sqlite(path)
    try:
        connection.executescript(schema)
        connection.commit()
        yield connection
    finally:
        connection.close()
