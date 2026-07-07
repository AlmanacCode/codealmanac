from datetime import datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database.local import open_local_database
from codealmanac.workflows.sync.models import SyncState
from codealmanac.workflows.sync.records import (
    sync_completed_at_value,
    sync_completed_state,
    sync_state_from_row,
)
from codealmanac.workflows.sync.tables import SYNC_STATE_TABLES

SYNC_STATE_KEY = "sync"


class SyncStateStore:
    def __init__(self, database_path: Path):
        self.database_path = normalize_path(database_path)

    def read(self) -> SyncState:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT last_completed_at
                FROM sync_state
                WHERE name = ?
                """,
                (SYNC_STATE_KEY,),
            ).fetchone()
        return sync_state_from_row(row)

    def record_completed(self, completed_at: datetime) -> SyncState:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO sync_state (name, last_completed_at)
                VALUES (?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    last_completed_at = excluded.last_completed_at
                """,
                (SYNC_STATE_KEY, sync_completed_at_value(completed_at)),
            )
            connection.commit()
        return sync_completed_state(completed_at)

    def connect(self):
        return open_local_database(self.database_path, SYNC_STATE_TABLES)
