from datetime import UTC, datetime, timedelta
from pathlib import Path

from codealmanac.core.errors import ConflictError, NotFoundError
from codealmanac.engine.harnesses.models import HarnessEvent, HarnessTranscriptRef
from codealmanac.jobs.ledger.factory import new_job_id, new_job_record
from codealmanac.jobs.ledger.io import JobLedgerIO
from codealmanac.jobs.ledger.locks import JobWorkerLease, acquire_worker_lock
from codealmanac.jobs.ledger.models import (
    TERMINAL_JOB_STATUSES,
    JobAttachSnapshot,
    JobCancelResult,
    JobEventKind,
    JobLogEvent,
    JobOperation,
    JobRecord,
    JobSpec,
    JobStatus,
    QueuedJob,
)
from codealmanac.jobs.ledger.queries import (
    list_job_records,
    next_spec_backed_queued_job,
)
from codealmanac.jobs.ledger.transitions import JobTransitionWriter


class JobStore:
    def __init__(
        self,
        ledger: JobLedgerIO | None = None,
        transitions: JobTransitionWriter | None = None,
    ):
        self.ledger = ledger or JobLedgerIO()
        self.transitions = transitions or JobTransitionWriter(self.ledger)

    def create(
        self,
        job_dir: Path,
        log_reference_dir: Path,
        workspace_id: str,
        operation: JobOperation,
        title: str | None,
    ) -> JobRecord:
        now = datetime.now(UTC)
        job_id = new_job_id(operation, now)
        record = new_job_record(
            job_id,
            workspace_id,
            operation,
            title,
            now,
            log_reference_dir,
        )
        self.transitions.write_queued_record(job_dir, record, now)
        return record

    def queue(
        self,
        job_dir: Path,
        log_reference_dir: Path,
        workspace_id: str,
        spec: JobSpec,
        title: str | None,
    ) -> JobRecord:
        now = datetime.now(UTC)
        job_id = new_job_id(spec.operation, now)
        record = new_job_record(
            job_id,
            workspace_id,
            spec.operation,
            title or spec.title,
            now,
            log_reference_dir,
        )
        self.ledger.write_spec(job_dir, record.job_id, spec)
        try:
            self.transitions.write_queued_record(job_dir, record, now)
        except Exception:
            self.ledger.delete_spec(job_dir, record.job_id)
            raise
        return record

    def list(self, job_dir: Path, limit: int | None) -> tuple[JobRecord, ...]:
        return list_job_records(self.ledger, job_dir, limit)

    def exists(self, job_dir: Path, job_id: str) -> bool:
        return self.ledger.read_record(job_dir, job_id) is not None

    def read(self, job_dir: Path, job_id: str) -> JobRecord:
        record = self.ledger.read_record(job_dir, job_id)
        if record is None:
            raise NotFoundError("job", job_id)
        return record

    def read_spec(self, job_dir: Path, job_id: str) -> JobSpec | None:
        self.read(job_dir, job_id)
        return self.ledger.read_spec(job_dir, job_id)

    def next_queued(self, job_dir: Path) -> QueuedJob | None:
        return next_spec_backed_queued_job(self.ledger, job_dir)

    def acquire_worker_lock(
        self,
        job_dir: Path,
        owner: str,
        pid: int,
        now: datetime,
        stale_after: timedelta,
    ) -> JobWorkerLease | None:
        return acquire_worker_lock(job_dir, owner, pid, now, stale_after)

    def log(self, job_dir: Path, job_id: str) -> tuple[JobLogEvent, ...]:
        self.read(job_dir, job_id)
        return self.ledger.iter_events(job_dir, job_id)

    def attach(self, job_dir: Path, job_id: str) -> JobAttachSnapshot:
        record = self.read(job_dir, job_id)
        return JobAttachSnapshot(
            record=record,
            events=self.ledger.iter_events(job_dir, job_id),
            terminal=record.status in TERMINAL_JOB_STATUSES,
        )

    def append(
        self,
        job_dir: Path,
        job_id: str,
        kind: JobEventKind,
        message: str,
        harness_event: HarnessEvent | None = None,
    ) -> JobLogEvent:
        record = self.read(job_dir, job_id)
        now = datetime.now(UTC)
        event = self.transitions.new_event(
            job_dir,
            job_id,
            now,
            kind,
            message,
            harness_event,
        )
        updated = record.model_copy(update={"updated_at": event.timestamp})
        self.transitions.write_record_with_event(
            job_dir,
            previous=record,
            record=updated,
            event=event,
        )
        return event

    def mark_running(self, job_dir: Path, job_id: str) -> JobRecord:
        record = self.read(job_dir, job_id)
        if record.status == JobStatus.RUNNING:
            return record
        if record.status != JobStatus.QUEUED:
            raise ConflictError(f"job {job_id} cannot start from {record.status.value}")
        now = datetime.now(UTC)
        running = record.model_copy(
            update={
                "status": JobStatus.RUNNING,
                "updated_at": now,
                "started_at": now,
            }
        )
        self.transitions.write_status_transition(
            job_dir,
            previous=record,
            record=running,
            timestamp=now,
            message=JobStatus.RUNNING.value,
        )
        return running

    def record_harness_transcript(
        self,
        job_dir: Path,
        job_id: str,
        transcript: HarnessTranscriptRef,
    ) -> JobRecord:
        record = self.read(job_dir, job_id)
        updated = record.model_copy(
            update={
                "harness_transcript": transcript,
                "updated_at": datetime.now(UTC),
            }
        )
        self.ledger.write_record(job_dir, updated)
        return updated

    def finish(
        self,
        job_dir: Path,
        job_id: str,
        status: JobStatus,
        summary: str | None,
        error: str | None,
    ) -> JobRecord:
        record = self.read(job_dir, job_id)
        if record.status == JobStatus.CANCELLED:
            return record
        now = datetime.now(UTC)
        finished = record.model_copy(
            update={
                "status": status,
                "summary": summary,
                "error": error,
                "updated_at": now,
                "finished_at": now,
            }
        )
        self.transitions.write_status_transition(
            job_dir,
            previous=record,
            record=finished,
            timestamp=now,
            message=status.value,
        )
        return finished

    def cancel(self, job_dir: Path, job_id: str) -> JobCancelResult:
        record = self.read(job_dir, job_id)
        if record.status in TERMINAL_JOB_STATUSES:
            return JobCancelResult(record=record, changed=False)
        now = datetime.now(UTC)
        cancelled = record.model_copy(
            update={
                "status": JobStatus.CANCELLED,
                "updated_at": now,
                "finished_at": now,
                "summary": record.summary,
                "error": record.error,
            }
        )
        self.transitions.write_status_transition(
            job_dir,
            previous=record,
            record=cancelled,
            timestamp=now,
            message=JobStatus.CANCELLED.value,
        )
        return JobCancelResult(record=cancelled, changed=True)
