from datetime import datetime
from uuid import uuid4

from codealmanac.services.runs.models import RunKind, RunRecord, RunStatus


def new_run_id(kind: RunKind, now: datetime) -> str:
    stamp = now.strftime("%Y%m%d%H%M%S")
    return f"{kind.value}-{stamp}-{uuid4().hex[:8]}"


def new_run_record(
    repository_id: str,
    kind: RunKind,
    title: str | None,
    now: datetime,
) -> RunRecord:
    run_id = new_run_id(kind, now)
    return RunRecord(
        run_id=run_id,
        repository_id=repository_id,
        kind=kind,
        status=RunStatus.QUEUED,
        title=title,
        created_at=now,
        updated_at=now,
    )
