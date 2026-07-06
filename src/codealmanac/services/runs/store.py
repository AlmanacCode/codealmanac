from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from codealmanac.core.errors import ConflictError, NotFoundError
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
from codealmanac.services.runs.tables import RUN_TABLES
from codealmanac.services.runs.worker_locks import RunWorkerLockStore


class RunStore:
    def __init__(
        self,
        database_path: Path,
        event_store: RunEventStore | None = None,
        lock_store: RunWorkerLockStore | None = None,
    ):
        self.database_path = database_path
        self.event_store = event_store or RunEventStore(database_path)
        self.lock_store = lock_store or RunWorkerLockStore(database_path)

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
        query = """
            SELECT record_json
            FROM runs
        """
        parameters: tuple[object, ...]
        if repository_id is None:
            parameters = ()
        else:
            query = f"{query} WHERE repository_id = ?"
            parameters = (repository_id,)
        query = f"""
            {query}
            ORDER BY created_at DESC, run_id DESC
        """
        if limit is not None:
            query = f"{query} LIMIT ?"
            parameters = (*parameters, limit)
        with self.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return tuple(run_record_from_json(row["record_json"]) for row in rows)

    def read(self, run_id: str) -> RunRecord:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT record_json FROM runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
        if row is None:
            raise NotFoundError("run", run_id)
        return run_record_from_json(row["record_json"])

    def read_spec(self, run_id: str) -> RunSpec | None:
        self.read(run_id)
        with self.connect() as connection:
            row = connection.execute(
                "SELECT spec_json FROM runs WHERE run_id = ?",
                (run_id,),
            ).fetchone()
        if row is None or row["spec_json"] is None:
            return None
        return RunSpec.model_validate_json(row["spec_json"])

    def next_queued(self) -> QueuedRun | None:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT record_json, spec_json
                FROM runs
                WHERE status = ? AND spec_json IS NOT NULL
                ORDER BY created_at ASC, run_id ASC
                LIMIT 1
                """,
                (RunStatus.QUEUED.value,),
            ).fetchone()
        if row is None:
            return None
        return QueuedRun(
            record=run_record_from_json(row["record_json"]),
            spec=RunSpec.model_validate_json(row["spec_json"]),
        )

    def queued_before(self, record: RunRecord) -> int:
        with self.connect() as connection:
            row = connection.execute(
                """
                SELECT COUNT(*)
                FROM runs
                WHERE status = ?
                  AND spec_json IS NOT NULL
                  AND (
                    created_at < ?
                    OR (created_at = ? AND run_id < ?)
                  )
                """,
                (
                    RunStatus.QUEUED.value,
                    record.created_at.isoformat(),
                    record.created_at.isoformat(),
                    record.run_id,
                ),
            ).fetchone()
        return int(row[0])

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
        self.write_record(updated, spec=self.read_spec(run_id))
        self.event_store.write(event)
        return event

    def mark_running(self, run_id: str) -> RunRecord:
        record = self.read(run_id)
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
        self.write_record(running, spec=self.read_spec(run_id))
        self.event_store.append_status(run_id, now, RunStatus.RUNNING.value)
        return running

    def record_harness_transcript(
        self,
        run_id: str,
        transcript: HarnessTranscriptRef,
    ) -> RunRecord:
        record = self.read(run_id)
        updated = record.model_copy(
            update={
                "harness_transcript": transcript,
                "updated_at": datetime.now(UTC),
            }
        )
        self.write_record(updated, spec=self.read_spec(run_id))
        return updated

    def finish(
        self,
        run_id: str,
        status: RunStatus,
        summary: str | None,
        error: str | None,
    ) -> RunRecord:
        record = self.read(run_id)
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
        self.write_record(finished, spec=self.read_spec(run_id))
        self.event_store.append_status(run_id, now, status.value)
        return finished

    def cancel(self, run_id: str) -> RunCancelResult:
        record = self.read(run_id)
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
        self.write_record(cancelled, spec=self.read_spec(run_id))
        self.event_store.append_status(run_id, now, RunStatus.CANCELLED.value)
        return RunCancelResult(record=cancelled, changed=True)

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


def run_record_from_json(value: str) -> RunRecord:
    return RunRecord.model_validate_json(value)


def queued_message(kind: RunKind) -> str:
    return f"queued {kind.value}"
