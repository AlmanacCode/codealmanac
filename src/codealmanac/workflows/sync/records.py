from datetime import UTC, datetime

from codealmanac.database.sqlite import SQLiteRow
from codealmanac.workflows.sync.models import SyncState


def sync_state_from_row(row: SQLiteRow | None) -> SyncState:
    if row is None or row["last_completed_at"] is None:
        return SyncState()
    return SyncState(
        last_completed_at=datetime.fromisoformat(
            str(row["last_completed_at"])
        ).astimezone(UTC)
    )


def sync_completed_at_value(completed_at: datetime) -> str:
    return completed_at.astimezone(UTC).isoformat()


def sync_completed_state(completed_at: datetime) -> SyncState:
    return SyncState(last_completed_at=completed_at.astimezone(UTC))
