from pathlib import Path

from codealmanac.services.runs.models import RunStatus
from codealmanac.services.runs.store import RunStore

ACTIVE_RUN_STATUSES = frozenset((RunStatus.QUEUED, RunStatus.RUNNING))


def active_run_count(database_path: Path) -> int:
    store = RunStore(database_path)
    return sum(
        1 for record in store.list(limit=None) if record.status in ACTIVE_RUN_STATUSES
    )
