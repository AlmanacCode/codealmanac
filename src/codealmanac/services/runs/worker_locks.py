from datetime import datetime, timedelta
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database.local import open_local_database
from codealmanac.services.runs.locks import RunWorkerLease, worker_lock_is_stale
from codealmanac.services.runs.models import RunWorkerLockOwner
from codealmanac.services.runs.tables import WORKER_LOCK_TABLES

WORKER_LOCK_NAME = "runs"


class RunWorkerLockStore:
    def __init__(self, database_path: Path):
        self.database_path = normalize_path(database_path)

    def acquire(
        self,
        owner: str,
        pid: int,
        now: datetime,
        stale_after: timedelta,
    ) -> RunWorkerLease | None:
        requested = RunWorkerLockOwner(owner=owner, pid=pid, acquired_at=now)
        with self.connect() as connection:
            row = connection.execute(
                "SELECT owner_json FROM worker_locks WHERE name = ?",
                (WORKER_LOCK_NAME,),
            ).fetchone()
            if row is not None:
                current = RunWorkerLockOwner.model_validate_json(row["owner_json"])
                if not worker_lock_is_stale(current, now, stale_after):
                    return None
            connection.execute(
                """
                INSERT INTO worker_locks (name, owner_json)
                VALUES (?, ?)
                ON CONFLICT(name) DO UPDATE SET owner_json = excluded.owner_json
                """,
                (WORKER_LOCK_NAME, requested.model_dump_json()),
            )
            connection.commit()
        return RunWorkerLease(requested, self.release)

    def release(self, owner: RunWorkerLockOwner) -> None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT owner_json FROM worker_locks WHERE name = ?",
                (WORKER_LOCK_NAME,),
            ).fetchone()
            if row is None:
                return
            current = RunWorkerLockOwner.model_validate_json(row["owner_json"])
            if current != owner:
                return
            connection.execute(
                "DELETE FROM worker_locks WHERE name = ?",
                (WORKER_LOCK_NAME,),
            )
            connection.commit()

    def connect(self):
        return open_local_database(self.database_path, WORKER_LOCK_TABLES)
