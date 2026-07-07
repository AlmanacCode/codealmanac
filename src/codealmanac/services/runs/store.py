from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.core.paths import normalize_path
from codealmanac.database.local import connect_local_database
from codealmanac.services.harnesses.models import HarnessEvent, HarnessTranscriptRef
from codealmanac.services.runs.events import RunEventStore
from codealmanac.services.runs.factory import new_run_record
from codealmanac.services.runs.locks import RunWorkerLease
from codealmanac.services.runs.models import (
    TERMINAL_RUN_STATUSES,
    QueuedRun,
    RunAttachSnapshot,
    RunCancelResult,
    RunEventKind,
    RunKind,
    RunLogEvent,
    RunRecord,
    RunSpec,
    RunStatus,
)
from codealmanac.services.runs.queries import (
    count_queued_runs_before,
    list_run_records,
    next_queued_run,
    read_run_record,
    read_run_with_spec,
)
from codealmanac.services.runs.tables import RUN_TABLES
from codealmanac.services.runs.transitions import (
    attach_harness_transcript,
    cancel_run,
    finish_run,
    queued_message,
    start_run,
)
from codealmanac.services.runs.worker_locks import RunWorkerLockStore


class RunStore:
    def __init__(
        self,
        database_path: Path,
        event_store: RunEventStore | None = None,
        lock_store: RunWorkerLockStore | None = None,
    ):
        self.database_path = normalize_path(database_path)
        self.event_store = event_store or RunEventStore(self.database_path)
        self.lock_store = lock_store or RunWorkerLockStore(self.database_path)

    def create(
        self,
        repository_id: str,
        kind: RunKind,
        title: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        record = new_run_record(repository_id, kind, title, now)
        self.write_record(record, spec=None)
        self.event_store.append_status(record.run_id, now, queued_message(record.kind))
        return record

    def queue(
        self,
        repository_id: str,
        spec: RunSpec,
        title: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        record = new_run_record(repository_id, spec.kind, title or spec.title, now)
        self.write_record(record, spec=spec)
        self.event_store.append_status(record.run_id, now, queued_message(record.kind))
        return record

    def list(
        self,
        limit: int | None,
        repository_id: str | None = None,
    ) -> tuple[RunRecord, ...]:
        with self.connect() as connection:
            return list_run_records(connection, limit, repository_id)

    def read(self, run_id: str) -> RunRecord:
        with self.connect() as connection:
            record = read_run_record(connection, run_id)
        if record is None:
            raise NotFoundError("run", run_id)
        return record

    def read_spec(self, run_id: str) -> RunSpec | None:
        with self.connect() as connection:
            result = read_run_with_spec(connection, run_id)
        if result is None:
            raise NotFoundError("run", run_id)
        _, spec = result
        return spec

    def next_queued(self) -> QueuedRun | None:
        with self.connect() as connection:
            return next_queued_run(connection)

    def queued_before(self, record: RunRecord) -> int:
        with self.connect() as connection:
            return count_queued_runs_before(connection, record)

    def acquire_worker_lock(
        self,
        owner: str,
        pid: int,
        now: datetime,
        stale_after: timedelta,
    ) -> RunWorkerLease | None:
        return self.lock_store.acquire(owner, pid, now, stale_after)

    def log(self, run_id: str) -> tuple[RunLogEvent, ...]:
        self.read(run_id)
        return self.event_store.list(run_id)

    def attach(self, run_id: str) -> RunAttachSnapshot:
        record = self.read(run_id)
        return RunAttachSnapshot(
            record=record,
            events=self.event_store.list(run_id),
            terminal=record.status in TERMINAL_RUN_STATUSES,
        )

    def record_event(
        self,
        run_id: str,
        kind: RunEventKind,
        message: str,
        harness_event: HarnessEvent | None = None,
    ) -> RunLogEvent:
        record = self.read(run_id)
        now = datetime.now(UTC)
        event = self.event_store.new_event(run_id, now, kind, message, harness_event)
        updated = record.model_copy(update={"updated_at": event.timestamp})
        self.update_record_preserving_spec(updated)
        self.event_store.write(event)
        return event

    def mark_running(self, run_id: str) -> RunRecord:
        record = self.read(run_id)
        now = datetime.now(UTC)
        running = start_run(record, now)
        if running is record:
            return record
        self.update_record_preserving_spec(running)
        self.event_store.append_status(run_id, now, RunStatus.RUNNING.value)
        return running

    def record_harness_transcript(
        self,
        run_id: str,
        transcript: HarnessTranscriptRef,
    ) -> RunRecord:
        record = self.read(run_id)
        updated = attach_harness_transcript(record, transcript, datetime.now(UTC))
        self.update_record_preserving_spec(updated)
        return updated

    def finish(
        self,
        run_id: str,
        status: RunStatus,
        summary: str | None,
        error: str | None,
    ) -> RunRecord:
        record = self.read(run_id)
        now = datetime.now(UTC)
        finished = finish_run(record, status, summary, error, now)
        if finished is record:
            return record
        self.update_record_preserving_spec(finished)
        self.event_store.append_status(run_id, now, status.value)
        return finished

    def cancel(self, run_id: str) -> RunCancelResult:
        record = self.read(run_id)
        now = datetime.now(UTC)
        result = cancel_run(record, now)
        if not result.changed:
            return result
        cancelled = result.record
        self.update_record_preserving_spec(cancelled)
        self.event_store.append_status(run_id, now, RunStatus.CANCELLED.value)
        return RunCancelResult(record=cancelled, changed=True)

    def update_record_preserving_spec(self, record: RunRecord) -> None:
        self.write_record(record, spec=self.read_spec(record.run_id))

    def write_record(self, record: RunRecord, spec: RunSpec | None) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                INSERT INTO runs (
                    run_id, repository_id, kind, status, title, created_at,
                    updated_at, record_json, spec_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    repository_id = excluded.repository_id,
                    kind = excluded.kind,
                    status = excluded.status,
                    title = excluded.title,
                    updated_at = excluded.updated_at,
                    record_json = excluded.record_json,
                    spec_json = excluded.spec_json
                """,
                (
                    record.run_id,
                    record.repository_id,
                    record.kind.value,
                    record.status.value,
                    record.title,
                    record.created_at.isoformat(),
                    record.updated_at.isoformat(),
                    record.model_dump_json(),
                    spec.model_dump_json() if spec is not None else None,
                ),
            )
            connection.commit()

    def connect(self):
        connection = connect_local_database(self.database_path)
        connection.executescript(RUN_TABLES)
        connection.commit()
        return connection
