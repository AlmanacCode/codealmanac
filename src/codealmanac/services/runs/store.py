from datetime import UTC, datetime, timedelta
from pathlib import Path

from codealmanac.core.errors import ConflictError, NotFoundError
from codealmanac.services.harnesses.models import HarnessEvent, HarnessTranscriptRef
from codealmanac.services.runs.factory import new_run_record
from codealmanac.services.runs.io import RunLedgerIO
from codealmanac.services.runs.locks import RunWorkerLease, acquire_worker_lock
from codealmanac.services.runs.models import (
    TERMINAL_RUN_STATUSES,
    QueuedRun,
    RunAttachSnapshot,
    RunCancelResult,
    RunEventKind,
    RunLogEvent,
    RunOperation,
    RunRecord,
    RunSpec,
    RunStatus,
)
from codealmanac.services.runs.queries import (
    list_run_records,
    next_spec_backed_queued_run,
)
from codealmanac.services.runs.transitions import RunTransitionWriter


class RunStore:
    def __init__(
        self,
        ledger: RunLedgerIO | None = None,
        transitions: RunTransitionWriter | None = None,
    ):
        self.ledger = ledger or RunLedgerIO()
        self.transitions = transitions or RunTransitionWriter(self.ledger)

    def create(
        self,
        almanac_path: Path,
        almanac_root: Path,
        workspace_id: str,
        operation: RunOperation,
        title: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        record = new_run_record(almanac_root, workspace_id, operation, title, now)
        self.transitions.write_queued_record(almanac_path, record, now)
        return record

    def queue(
        self,
        almanac_path: Path,
        almanac_root: Path,
        workspace_id: str,
        spec: RunSpec,
        title: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        record = new_run_record(
            almanac_root,
            workspace_id,
            spec.operation,
            title or spec.title,
            now,
        )
        self.ledger.write_spec(almanac_path, record.run_id, spec)
        try:
            self.transitions.write_queued_record(almanac_path, record, now)
        except Exception:
            self.ledger.delete_spec(almanac_path, record.run_id)
            raise
        return record

    def list(self, almanac_path: Path, limit: int | None) -> tuple[RunRecord, ...]:
        return list_run_records(self.ledger, almanac_path, limit)

    def read(self, almanac_path: Path, run_id: str) -> RunRecord:
        record = self.ledger.read_record(almanac_path, run_id)
        if record is None:
            raise NotFoundError("run", run_id)
        return record

    def read_spec(self, almanac_path: Path, run_id: str) -> RunSpec | None:
        self.read(almanac_path, run_id)
        return self.ledger.read_spec(almanac_path, run_id)

    def next_queued(self, almanac_path: Path) -> QueuedRun | None:
        return next_spec_backed_queued_run(self.ledger, almanac_path)

    def acquire_worker_lock(
        self,
        almanac_path: Path,
        owner: str,
        pid: int,
        now: datetime,
        stale_after: timedelta,
    ) -> RunWorkerLease | None:
        return acquire_worker_lock(almanac_path, owner, pid, now, stale_after)

    def log(self, almanac_path: Path, run_id: str) -> tuple[RunLogEvent, ...]:
        self.read(almanac_path, run_id)
        return self.ledger.iter_events(almanac_path, run_id)

    def attach(self, almanac_path: Path, run_id: str) -> RunAttachSnapshot:
        record = self.read(almanac_path, run_id)
        return RunAttachSnapshot(
            record=record,
            events=self.ledger.iter_events(almanac_path, run_id),
            terminal=record.status in TERMINAL_RUN_STATUSES,
        )

    def append(
        self,
        almanac_path: Path,
        run_id: str,
        kind: RunEventKind,
        message: str,
        harness_event: HarnessEvent | None = None,
    ) -> RunLogEvent:
        record = self.read(almanac_path, run_id)
        now = datetime.now(UTC)
        event = self.transitions.new_event(
            almanac_path,
            run_id,
            now,
            kind,
            message,
            harness_event,
        )
        updated = record.model_copy(update={"updated_at": event.timestamp})
        self.transitions.write_record_with_event(
            almanac_path,
            previous=record,
            record=updated,
            event=event,
        )
        return event

    def mark_running(self, almanac_path: Path, run_id: str) -> RunRecord:
        record = self.read(almanac_path, run_id)
        if record.status == RunStatus.RUNNING:
            return record
        if record.status != RunStatus.QUEUED:
            raise ConflictError(
                f"run {run_id} cannot start from {record.status.value}"
            )
        now = datetime.now(UTC)
        running = record.model_copy(
            update={
                "status": RunStatus.RUNNING,
                "updated_at": now,
                "started_at": now,
            }
        )
        self.transitions.write_status_transition(
            almanac_path,
            previous=record,
            record=running,
            timestamp=now,
            message=RunStatus.RUNNING.value,
        )
        return running

    def record_harness_transcript(
        self,
        almanac_path: Path,
        run_id: str,
        transcript: HarnessTranscriptRef,
    ) -> RunRecord:
        record = self.read(almanac_path, run_id)
        updated = record.model_copy(
            update={
                "harness_transcript": transcript,
                "updated_at": datetime.now(UTC),
            }
        )
        self.ledger.write_record(almanac_path, updated)
        return updated

    def finish(
        self,
        almanac_path: Path,
        run_id: str,
        status: RunStatus,
        summary: str | None,
        error: str | None,
    ) -> RunRecord:
        record = self.read(almanac_path, run_id)
        if record.status == RunStatus.CANCELLED:
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
            almanac_path,
            previous=record,
            record=finished,
            timestamp=now,
            message=status.value,
        )
        return finished

    def cancel(self, almanac_path: Path, run_id: str) -> RunCancelResult:
        record = self.read(almanac_path, run_id)
        if record.status in TERMINAL_RUN_STATUSES:
            return RunCancelResult(record=record, changed=False)
        now = datetime.now(UTC)
        cancelled = record.model_copy(
            update={
                "status": RunStatus.CANCELLED,
                "updated_at": now,
                "finished_at": now,
                "summary": record.summary,
                "error": record.error,
            }
        )
        self.transitions.write_status_transition(
            almanac_path,
            previous=record,
            record=cancelled,
            timestamp=now,
            message=RunStatus.CANCELLED.value,
        )
        return RunCancelResult(record=cancelled, changed=True)
