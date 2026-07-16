from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from codealmanac.database.local import open_local_database
from codealmanac.services.telemetry.models import TelemetryIdentity

SCHEMA = """
CREATE TABLE IF NOT EXISTS telemetry_installation (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    installation_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS telemetry_delivery (
    event_key TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    claimed_at TEXT NOT NULL
);
"""


class TelemetryIdentityStore:
    def __init__(self, database_path: Path):
        self.database_path = database_path

    def get_or_create(self) -> TelemetryIdentity:
        with open_local_database(self.database_path, SCHEMA) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT installation_id FROM telemetry_installation WHERE singleton = 1"
            ).fetchone()
            if row is None:
                installation_id = str(uuid4())
                connection.execute(
                    """
                    INSERT INTO telemetry_installation (
                        singleton, installation_id, created_at
                    ) VALUES (1, ?, ?)
                    """,
                    (installation_id, datetime.now(UTC).isoformat()),
                )
                connection.commit()
            else:
                installation_id = str(row["installation_id"])
        return TelemetryIdentity(
            installation_id=UUID(installation_id),
            distinct_id=installation_id,
            kind="anonymous",
        )

    def claim_event(self, event_key: str) -> str | None:
        event_id = str(uuid4())
        with open_local_database(self.database_path, SCHEMA) as connection:
            result = connection.execute(
                """
                INSERT OR IGNORE INTO telemetry_delivery (
                    event_key, event_id, claimed_at
                ) VALUES (?, ?, ?)
                """,
                (event_key, event_id, datetime.now(UTC).isoformat()),
            )
            connection.commit()
        return event_id if result.rowcount == 1 else None
