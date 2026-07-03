from datetime import datetime
from pathlib import Path

from codealmanac.engine.harnesses.models import HarnessEvent
from codealmanac.jobs.ledger.io import JobLedgerIO
from codealmanac.jobs.ledger.models import (
    JobEventKind,
    JobLogEvent,
    JobRecord,
)


class JobTransitionWriter:
    def __init__(self, ledger: JobLedgerIO):
        self.ledger = ledger

    def write_queued_record(
        self,
        job_dir: Path,
        record: JobRecord,
        timestamp: datetime,
    ) -> None:
        event = self.new_event(
            job_dir,
            record.job_id,
            timestamp,
            JobEventKind.STATUS,
            f"queued {record.operation.value}",
        )
        self.write_record_with_event(
            job_dir,
            previous=None,
            record=record,
            event=event,
        )

    def write_status_transition(
        self,
        job_dir: Path,
        previous: JobRecord,
        record: JobRecord,
        timestamp: datetime,
        message: str,
    ) -> None:
        event = self.new_event(
            job_dir,
            record.job_id,
            timestamp,
            JobEventKind.STATUS,
            message,
        )
        self.write_record_with_event(
            job_dir,
            previous=previous,
            record=record,
            event=event,
        )

    def write_record_with_event(
        self,
        job_dir: Path,
        previous: JobRecord | None,
        record: JobRecord,
        event: JobLogEvent,
    ) -> None:
        self.ledger.write_record(job_dir, record)
        try:
            self.ledger.append_event(job_dir, event)
        except Exception:
            self.restore_record(job_dir, previous, record.job_id)
            raise

    def new_event(
        self,
        job_dir: Path,
        job_id: str,
        timestamp: datetime,
        kind: JobEventKind,
        message: str,
        harness_event: HarnessEvent | None = None,
    ) -> JobLogEvent:
        return JobLogEvent(
            job_id=job_id,
            sequence=self.ledger.next_sequence(job_dir, job_id),
            timestamp=timestamp,
            kind=kind,
            message=message,
            harness_event=harness_event,
        )

    def restore_record(
        self,
        job_dir: Path,
        previous: JobRecord | None,
        job_id: str,
    ) -> None:
        if previous is None:
            self.ledger.delete_record(job_dir, job_id)
            return
        self.ledger.write_record(job_dir, previous)
