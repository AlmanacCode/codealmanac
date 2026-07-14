from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from codealmanac.core.errors import NotFoundError
from codealmanac.core.paths import normalize_path
from codealmanac.database.local import open_local_database
from codealmanac.database.sqlite import SQLiteConnection
from codealmanac.services.harnesses.models import HarnessEvent, HarnessTranscriptRef
from codealmanac.services.runs.events import RunEventStore
from codealmanac.services.runs.factory import new_run_record
from codealmanac.services.runs.locks import RunWorkerLease
from codealmanac.services.runs.models import (
    TERMINAL_RUN_STATUSES,
    QueuedRun,
    RunAttachSnapshot,
    RunCancellationPlan,
    RunCancelResult,
    RunEventKind,
    RunExecutionRef,
    RunKind,
    RunLogEvent,
    RunRecord,
    RunSpec,
    RunStatus,
    RunWorkerIdleHandoffOutcome,
    RunWorkerLockOwner,
)
from codealmanac.services.runs.queries import (
    active_run_exists,
    count_queued_runs_before,
    list_run_records,
    next_queued_run,
    read_run_record,
    read_run_with_spec,
)
from codealmanac.services.runs.records import run_record_json, run_spec_json
from codealmanac.services.runs.tables import RUN_EVENT_TABLES, RUN_TABLES
from codealmanac.services.runs.transitions import (
    attach_harness_transcript,
    finish_cancellation,
    finish_run,
    prepare_cancellation,
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
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            self.write_record_on_connection(connection, record, spec=None)
            self.event_store.append_on_connection(
                connection,
                record.run_id,
                now,
                RunEventKind.STATUS,
                queued_message(record.kind),
            )
            connection.commit()
        return record

    def queue(
        self,
        repository_id: str,
        spec: RunSpec,
        title: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        record = new_run_record(repository_id, spec.kind, title or spec.title, now)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            self.write_record_on_connection(connection, record, spec=spec)
            self.event_store.append_on_connection(
                connection,
                record.run_id,
                now,
                RunEventKind.STATUS,
                queued_message(record.kind),
            )
            connection.commit()
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

    def has_active_run(self, repository_id: str, kind: RunKind) -> bool:
        with self.connect() as connection:
            return active_run_exists(connection, repository_id, kind)

    def acquire_worker_lock(
        self,
        owner: str,
        pid: int,
        now: datetime,
        stale_after: timedelta,
    ) -> RunWorkerLease | None:
        return self.lock_store.acquire(owner, pid, now, stale_after)

    def release_worker_if_idle(
        self,
        owner: RunWorkerLockOwner,
    ) -> RunWorkerIdleHandoffOutcome:
        return self.lock_store.release_if_idle(owner)

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
        now = datetime.now(UTC)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            record, spec = self.read_with_spec_on_connection(connection, run_id)
            event = self.event_store.append_on_connection(
                connection,
                run_id,
                now,
                kind,
                message,
                harness_event,
            )
            updated = record.model_copy(update={"updated_at": event.timestamp})
            self.write_record_on_connection(connection, updated, spec)
            connection.commit()
            return event

    def mark_running(
        self,
        run_id: str,
        execution: RunExecutionRef | None = None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            record, spec = self.read_with_spec_on_connection(connection, run_id)
            running = start_run(record, now, execution)
            if running is record:
                connection.commit()
                return record
            self.write_record_on_connection(connection, running, spec)
            self.event_store.append_on_connection(
                connection,
                run_id,
                now,
                RunEventKind.STATUS,
                RunStatus.RUNNING.value,
            )
            connection.commit()
            return running

    def record_harness_transcript(
        self,
        run_id: str,
        transcript: HarnessTranscriptRef,
    ) -> RunRecord:
        now = datetime.now(UTC)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            record, spec = self.read_with_spec_on_connection(connection, run_id)
            updated = attach_harness_transcript(record, transcript, now)
            self.write_record_on_connection(connection, updated, spec)
            connection.commit()
            return updated

    def finish(
        self,
        run_id: str,
        status: RunStatus,
        summary: str | None,
        error: str | None,
    ) -> RunRecord:
        now = datetime.now(UTC)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            record, spec = self.read_with_spec_on_connection(connection, run_id)
            finished = finish_run(record, status, summary, error, now)
            if finished is record:
                connection.commit()
                return record
            self.write_record_on_connection(connection, finished, spec)
            self.event_store.append_on_connection(
                connection,
                run_id,
                now,
                RunEventKind.STATUS,
                status.value,
            )
            connection.commit()
            return finished

    def prepare_cancellation(self, run_id: str) -> RunCancellationPlan:
        now = datetime.now(UTC)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            record, spec = self.read_with_spec_on_connection(connection, run_id)
            plan, event_message = prepare_cancellation(record, now)
            if not plan.changed:
                connection.commit()
                return plan
            self.write_record_on_connection(connection, plan.record, spec)
            if event_message is not None:
                kind = (
                    RunEventKind.STATUS
                    if plan.record.status == RunStatus.CANCELLED
                    else RunEventKind.MESSAGE
                )
                self.event_store.append_on_connection(
                    connection,
                    run_id,
                    now,
                    kind,
                    event_message,
                )
            connection.commit()
            return plan

    def finish_cancellation(
        self,
        run_id: str,
        execution_id: str,
    ) -> RunCancelResult:
        now = datetime.now(UTC)
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            record, spec = self.read_with_spec_on_connection(connection, run_id)
            result = finish_cancellation(record, execution_id, now)
            if not result.changed:
                connection.commit()
                return result
            self.write_record_on_connection(connection, result.record, spec)
            self.event_store.append_on_connection(
                connection,
                run_id,
                now,
                RunEventKind.STATUS,
                RunStatus.CANCELLED.value,
            )
            connection.commit()
            return result

    def write_record_on_connection(
        self,
        connection: SQLiteConnection,
        record: RunRecord,
        spec: RunSpec | None,
    ) -> None:
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
                run_record_json(record),
                run_spec_json(spec),
            ),
        )

    def read_with_spec_on_connection(
        self,
        connection: SQLiteConnection,
        run_id: str,
    ) -> tuple[RunRecord, RunSpec | None]:
        result = read_run_with_spec(connection, run_id)
        if result is None:
            raise NotFoundError("run", run_id)
        return result

    def connect(self):
        return open_local_database(self.database_path, RUN_TABLES + RUN_EVENT_TABLES)
