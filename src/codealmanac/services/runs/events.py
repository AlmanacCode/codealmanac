from datetime import datetime
from pathlib import Path

from codealmanac.core.paths import normalize_path
from codealmanac.database.local import open_local_database
from codealmanac.database.sqlite import SQLiteConnection
from codealmanac.services.harnesses.models import HarnessEvent
from codealmanac.services.runs.models import RunEventKind, RunLogEvent
from codealmanac.services.runs.tables import RUN_EVENT_TABLES


class RunEventStore:
    def __init__(self, database_path: Path):
        self.database_path = normalize_path(database_path)

    def append_on_connection(
        self,
        connection: SQLiteConnection,
        run_id: str,
        timestamp: datetime,
        kind: RunEventKind,
        message: str,
        harness_event: HarnessEvent | None = None,
    ) -> RunLogEvent:
        event = RunLogEvent(
            run_id=run_id,
            sequence=self.next_sequence_on_connection(connection, run_id),
            timestamp=timestamp,
            kind=kind,
            message=message,
            harness_event=harness_event,
        )
        self.write_on_connection(connection, event)
        return event

    def write_on_connection(
        self,
        connection: SQLiteConnection,
        event: RunLogEvent,
    ) -> None:
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

    def next_sequence_on_connection(
        self,
        connection: SQLiteConnection,
        run_id: str,
    ) -> int:
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
        return open_local_database(self.database_path, RUN_EVENT_TABLES)
