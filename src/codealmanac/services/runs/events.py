from datetime import datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database.local import connect_local_database
from codealmanac.services.harnesses.models import HarnessEvent
from codealmanac.services.runs.models import RunEventKind, RunLogEvent
from codealmanac.services.runs.tables import RUN_EVENT_TABLES


class RunEventStore:
    def __init__(self, database_path: Path):
        self.database_path = normalize_path(database_path)

    def append_status(
        self,
        run_id: str,
        timestamp: datetime,
        message: str,
    ) -> None:
        self.write(self.new_event(run_id, timestamp, RunEventKind.STATUS, message))

    def new_event(
        self,
        run_id: str,
        timestamp: datetime,
        kind: RunEventKind,
        message: str,
        harness_event: HarnessEvent | None = None,
    ) -> RunLogEvent:
        return RunLogEvent(
            run_id=run_id,
            sequence=self.next_sequence(run_id),
            timestamp=timestamp,
            kind=kind,
            message=message,
            harness_event=harness_event,
        )

    def write(self, event: RunLogEvent) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO run_events (run_id, sequence, created_at, event_json)
                VALUES (?, ?, ?, ?)
                """,
                (
                    event.run_id,
                    event.sequence,
                    event.timestamp.isoformat(),
                    event.model_dump_json(exclude_none=True),
                ),
            )
            connection.commit()

    def next_sequence(self, run_id: str) -> int:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT COALESCE(MAX(sequence), 0) + 1
                FROM run_events
                WHERE run_id = ?
                """,
                (run_id,),
            ).fetchone()
        return int(row[0])

    def list(self, run_id: str) -> tuple[RunLogEvent, ...]:
        with self.connect() as connection:
            rows = connection.execute(
                """
                SELECT event_json
                FROM run_events
                WHERE run_id = ?
                ORDER BY sequence ASC
                """,
                (run_id,),
            ).fetchall()
        return tuple(RunLogEvent.model_validate_json(row["event_json"]) for row in rows)

    def connect(self):
        connection = connect_local_database(self.database_path)
        connection.executescript(RUN_EVENT_TABLES)
        connection.commit()
        return connection
