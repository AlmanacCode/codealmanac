from pathlib import Path

from codealmanac.database import SQLiteConnection, user_version
from codealmanac.services.control.models import ControlSchemaStatus
from codealmanac.services.control.schema import CONTROL_TABLES, connect_control


class ControlStore:
    def __init__(self, path: Path):
        self.path = path

    def ensure_ready(self) -> ControlSchemaStatus:
        with connect_control(self.path) as connection:
            return ControlSchemaStatus(
                path=self.path,
                user_version=user_version(connection),
                tables=control_tables(connection),
            )

    def status(self, ensure: bool) -> ControlSchemaStatus:
        if ensure:
            return self.ensure_ready()
        if not self.path.exists():
            return ControlSchemaStatus(path=self.path, user_version=0, tables=())
        with connect_control(self.path) as connection:
            return ControlSchemaStatus(
                path=self.path,
                user_version=user_version(connection),
                tables=control_tables(connection),
            )


def control_tables(connection: SQLiteConnection) -> tuple[str, ...]:
    rows = connection.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ({placeholders})
        ORDER BY name
        """.format(placeholders=", ".join("?" for _ in CONTROL_TABLES)),
        CONTROL_TABLES,
    ).fetchall()
    return tuple(row["name"] for row in rows)
