from datetime import datetime
from pathlib import Path
from uuid import uuid4

from codealmanac.jobs.ledger.models import JobOperation, JobRecord, JobStatus
from codealmanac.jobs.ledger.paths import job_log_reference_path


def new_job_id(operation: JobOperation, now: datetime) -> str:
    stamp = now.strftime("%Y%m%d%H%M%S")
    return f"{operation.value}-{stamp}-{uuid4().hex[:8]}"


def new_job_record(
    job_id: str,
    workspace_id: str,
    operation: JobOperation,
    title: str | None,
    now: datetime,
    log_reference_dir: Path,
) -> JobRecord:
    return JobRecord(
        job_id=job_id,
        workspace_id=workspace_id,
        operation=operation,
        status=JobStatus.QUEUED,
        title=title,
        created_at=now,
        updated_at=now,
        log_path=job_log_reference_path(log_reference_dir, job_id),
    )
