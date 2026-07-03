from pathlib import Path

from codealmanac.jobs.ledger.io import JobLedgerIO
from codealmanac.jobs.ledger.models import JobRecord, JobStatus, QueuedJob


def list_job_records(
    ledger: JobLedgerIO,
    job_dir: Path,
    limit: int | None,
) -> tuple[JobRecord, ...]:
    records = sorted(
        ledger.iter_records(job_dir),
        key=lambda record: (record.created_at, record.job_id),
        reverse=True,
    )
    if limit is not None:
        return tuple(records[:limit])
    return tuple(records)


def next_spec_backed_queued_job(
    ledger: JobLedgerIO,
    job_dir: Path,
) -> QueuedJob | None:
    records = sorted(
        ledger.iter_records(job_dir),
        key=lambda record: (record.created_at, record.job_id),
    )
    for record in records:
        if record.status != JobStatus.QUEUED:
            continue
        spec = ledger.read_spec(job_dir, record.job_id)
        if spec is None:
            continue
        return QueuedJob(record=record, spec=spec)
    return None
